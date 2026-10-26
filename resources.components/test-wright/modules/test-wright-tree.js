'use strict';

/*
 * Bots tree: suite folders (branches) and bot files (leaves), the drag source of the plan.
 *
 * Looks and behaves like a VS Code tree: 22px rows, indent guides, folder and file icons, the
 * last-run status of each bot, a hover "+" that adds the row to the plan, and keyboard navigation
 * (Up/Down move, Left/Right collapse/expand, Home/End, Enter adds to the plan, Space opens a bot
 * or toggles a suite). The selection is kept in runtime.treeSelection as a row key, so it
 * survives the full re-render showApp() does.
 */

// Indentation per tree level, in pixels (matches the CSS guide positions).
const TREE_INDENT = 12;

// Left padding of a level-0 row, in pixels.
const TREE_PADDING = 6;

// Icons (embedded; fill follows the theme through currentColor).
const TREE_ICONS = {
    chevron: '<svg viewBox="0 0 640 640" aria-hidden="true"><path fill="currentColor" d="M297.4 438.6C309.9 451.1 330.2 451.1 342.7 438.6L502.7 278.6C515.2 266.1 515.2 245.8 502.7 233.3C490.2 220.8 469.9 220.8 457.4 233.3L320 370.7L182.6 233.4C170.1 220.9 149.8 220.9 137.3 233.4C124.8 245.9 124.8 266.2 137.3 278.7L297.3 438.7z"/></svg>',
    folderClosed: '<svg viewBox="0 0 640 640" aria-hidden="true"><path fill="currentColor" d="M128 512L512 512C547.3 512 576 483.3 576 448L576 208C576 172.7 547.3 144 512 144L362.7 144C355.8 144 349 141.8 343.5 137.6L305.1 108.8C294 100.5 280.5 96 266.7 96L128 96C92.7 96 64 124.7 64 160L64 448C64 483.3 92.7 512 128 512z"/></svg>',
    folderOpen: '<svg viewBox="0 0 640 640" aria-hidden="true"><path fill="currentColor" d="M88 289.6L64.4 360.2L64.4 160C64.4 124.7 93.1 96 128.4 96L267.1 96C280.9 96 294.4 100.5 305.5 108.8L343.9 137.6C349.4 141.8 356.2 144 363.1 144L480.4 144C515.7 144 544.4 172.7 544.4 208L544.4 224L179 224C137.7 224 101 250.4 87.9 289.6zM509.8 512L131 512C98.2 512 75.1 479.9 85.5 448.8L133.5 304.8C140 285.2 158.4 272 179 272L557.8 272C590.6 272 613.7 304.1 603.3 335.2L555.3 479.2C548.8 498.8 530.4 512 509.8 512z"/></svg>',
    file: '<svg viewBox="0 0 640 640" aria-hidden="true"><path fill="currentColor" d="M304 112L192 112C183.2 112 176 119.2 176 128L176 512C176 520.8 183.2 528 192 528L448 528C456.8 528 464 520.8 464 512L464 272L376 272C336.2 272 304 239.8 304 200L304 112zM444.1 224L352 131.9L352 200C352 213.3 362.7 224 376 224L444.1 224zM128 128C128 92.7 156.7 64 192 64L325.5 64C342.5 64 358.8 70.7 370.8 82.7L493.3 205.3C505.3 217.3 512 233.6 512 250.6L512 512C512 547.3 483.3 576 448 576L192 576C156.7 576 128 547.3 128 512L128 128z"/></svg>',
    add: '<svg viewBox="0 0 640 640" aria-hidden="true"><path fill="currentColor" d="M288 128H352V288H512V352H352V512H288V352H128V288H288Z"/></svg>',
    passed: '<svg viewBox="0 0 640 640" aria-hidden="true"><path fill="none" stroke="currentColor" stroke-width="64" stroke-linecap="round" stroke-linejoin="round" d="M128 336L256 464L512 176"/></svg>',
    failed: '<svg viewBox="0 0 640 640" aria-hidden="true"><path fill="none" stroke="currentColor" stroke-width="64" stroke-linecap="round" d="M176 176L464 464M464 176L176 464"/></svg>',
    warning: '<svg viewBox="0 0 640 640" aria-hidden="true"><path fill="currentColor" fill-rule="evenodd" d="M320 64L592 544H48ZM296 224V384H344V224ZM296 424V472H344V424Z"/></svg>',
    dot: '<svg viewBox="0 0 640 640" aria-hidden="true"><circle fill="currentColor" cx="320" cy="320" r="128"/></svg>'
};

// Last-run status -> icon name (statuses without an entry show no icon).
const TREE_STATUS_ICONS = {
    passed: 'passed',
    failed: 'failed',
    broken: 'failed',
    warning: 'warning',
    canceled: 'dot',
    queued: 'dot',
    running: 'dot'
};

/**
 * Adds the bots of a tree row to the end of the plan.
 *
 * @param {string[]} ids - The bot ids.
 * @returns {void}
 */
function addTreeRowToPlan(ids) {
    // addTestsToPlan logs the add, for this button and for a drop alike.
    if (ids.length > 0) {
        addTestsToPlan(ids);
    }
}

/**
 * Clears all discovered bots from the tree (after confirmation). The plan is unaffected.
 *
 * @returns {Promise<void>}
 */
async function clearTree() {
    if (state.tests.length === 0) {
        return;
    }

    const isConfirmed = await confirmDialog({
        title: 'Clear tree',
        message: 'This clears all discovered bots from the tree. Run Discover again to repopulate it. The plan is unaffected. Continue?',
        confirmLabel: 'Clear tree'
    });

    if (!isConfirmed) {
        return;
    }

    state.tests = [];
    state.selectedTags.clear();
    state.collapsedNodes.clear();

    if (runtime.activeRuns === 0) {
        updateIdleStatus();
    }

    writeLog('Tree cleared. Run Discover to repopulate.', 'muted');
    showApp();
}

/**
 * Makes a tree row a drag source that carries bot ids into the plan.
 *
 * @param {HTMLElement} rowElement - The draggable row.
 * @param {string[]} ids - The bot ids to carry.
 * @param {string} label - The drag's text/plain label.
 * @returns {void}
 */
function enableTreeDrag(rowElement, ids, label) {
    rowElement.addEventListener('dragstart', (event) => {
        runtime.dragPayload = { kind: 'tests', ids };
        event.dataTransfer.effectAllowed = 'copy';
        event.dataTransfer.setData('text/plain', label);
        rowElement.classList.add('dragging');
    });

    rowElement.addEventListener('dragend', () => {
        rowElement.classList.remove('dragging');
        runtime.dragPayload = null;
        clearPlanDropMarkers();
    });
}

/**
 * Returns all bot ids under a node, in display order (child suites first, then bots).
 *
 * @param {object} node - The tree node.
 * @returns {string[]} The contained bot ids.
 */
function getNodeTestIds(node) {
    const ids = [];

    getSortedChildren(node).forEach((child) => ids.push(...getNodeTestIds(child)));
    node.tests.forEach((test) => ids.push(test.id));

    return ids;
}

/**
 * Returns a node's child suites sorted by name.
 *
 * @param {object} node - The tree node.
 * @returns {Array<object>} The sorted children.
 */
function getSortedChildren(node) {
    return [...node.children.values()].sort((left, right) => left.name.localeCompare(right.name));
}

/**
 * Builds a suite tree from the visible bots: each folder of a bot id is a branch.
 *
 * @param {Array<object>} tests - The visible bots.
 * @returns {object} The synthetic root node.
 */
function newSuiteTree(tests) {
    const root = { name: '', path: '', children: new Map(), tests: [] };

    tests.forEach((test) => {
        const folders = test.suite ? test.suite.split('/').filter(Boolean) : [];
        let node = root;
        let path = '';

        folders.forEach((folder) => {
            path = path ? `${path}/${folder}` : folder;

            if (!node.children.has(folder)) {
                node.children.set(folder, { name: folder, path, children: new Map(), tests: [] });
            }

            node = node.children.get(folder);
        });

        node.tests.push(test);
    });

    return root;
}

/**
 * Expands or collapses every suite.
 *
 * @param {boolean} isCollapsed - True to collapse all.
 * @returns {void}
 */
function setAllNodesCollapsed(isCollapsed) {
    state.collapsedNodes.clear();

    if (isCollapsed) {
        state.tests.forEach((test) => {
            const folders = test.suite ? test.suite.split('/') : [];

            folders.forEach((_, index) => state.collapsedNodes.add(folders.slice(0, index + 1).join('/')));
        });
    }

    showApp();
}

/**
 * Renders the bots tree for the visible bots (or an empty state).
 *
 * @returns {void}
 */
function showTree() {
    const list = elements['tree-list'];

    runtime.treeRows = new Map();

    if (!state.folderPath) {
        list.innerHTML = writeEmptyState('folder', 'No bots folder selected', 'Choose the bots folder in the header to begin.');

        return;
    }

    if (state.tests.length === 0) {
        list.innerHTML = writeEmptyState('search', 'No bots discovered', 'Run Discover Bots to populate the tree.');

        return;
    }

    const visible = getVisibleTests();

    if (visible.length === 0) {
        list.innerHTML = writeEmptyState('filter', 'No bots match the filter', 'Adjust the text filter or the tag selection.');

        return;
    }

    const root = newSuiteTree(visible);

    list.replaceChildren();
    getSortedChildren(root).forEach((child) => list.appendChild(showTreeNode(child, 0, '')));
    root.tests.forEach((test) => list.appendChild(showTreeLeaf(test, 0, '')));

    // A selection whose row is gone (filtered or collapsed away) is dropped.
    if (!runtime.treeRows.has(runtime.treeSelection)) {
        runtime.treeSelection = '';
    }

    list.setAttribute('aria-activedescendant', runtime.treeSelection ? getTreeRowElementId(runtime.treeSelection) : '');
}

/**
 * Renders one bot row: icon, name, tags, last-run status, and the hover "+" button.
 * Double-click (or Space) opens the bot file.
 *
 * @param {object} test - The bot.
 * @param {number} depth - The tree level.
 * @param {string} parentKey - The row key of the parent suite ('' at the root).
 * @returns {HTMLElement} The leaf row.
 */
function showTreeLeaf(test, depth, parentKey) {
    const key = `bot:${test.id}`;
    const row = newTreeRow(key, depth, 'tree-leaf');
    const status = runtime.lastStatuses.get(test.id) || '';
    const tags = test.tags || [];

    row.title = `${test.file}${tags.length > 0 ? `\nTags: ${tags.join(', ')}` : ''}` +
        `${status ? `\nLast run: ${getStatusLabel(status)}` : ''}\nDrag or press + to add to the plan; double-click to open.`;
    row.dataset.testId = `tree-bot-${test.id}`;
    row.append(
        newTreeSpacer(),
        newTreeIcon('file', 'tree-icon tree-icon-bot'),
        newTreeName(test.name),
        newTreeChips(tags),
        newTreeStatus(status),
        newTreeAddButton([test.id], `Add ${test.name} to the plan`)
    );

    row.addEventListener('dblclick', () => openTreeBot(test));
    enableTreeDrag(row, [test.id], test.id);
    runtime.treeRows.set(key, { kind: 'bot', ids: [test.id], parentKey, test });

    return row;
}

/**
 * Renders one suite row plus its children when expanded.
 *
 * @param {object} node - The suite node.
 * @param {number} depth - The tree level.
 * @param {string} parentKey - The row key of the parent suite ('' at the root).
 * @returns {DocumentFragment} The suite fragment.
 */
function showTreeNode(node, depth, parentKey) {
    const fragment = document.createDocumentFragment();
    const key = `suite:${node.path}`;
    const isCollapsed = state.collapsedNodes.has(node.path);
    const ids = getNodeTestIds(node);
    const row = newTreeRow(key, depth, 'tree-branch');
    const chevron = newTreeIcon('chevron', `tree-chevron${isCollapsed ? ' collapsed' : ''}`);
    const count = document.createElement('span');

    row.title = `${node.path}\n${ids.length} bot(s). Click to expand or collapse; drag or press + to add them all to the plan.`;
    row.dataset.testId = `tree-suite-${node.path}`;
    row.setAttribute('aria-expanded', String(!isCollapsed));
    count.className = 'tree-count';
    count.textContent = String(ids.length);
    row.append(
        chevron,
        newTreeIcon(isCollapsed ? 'folderClosed' : 'folderOpen', 'tree-icon tree-icon-suite'),
        newTreeName(node.name),
        count,
        newTreeAddButton(ids, `Add the ${ids.length} bot(s) of ${node.name} to the plan`)
    );

    row.addEventListener('click', () => setTreeNodeCollapsed(node.path, !isCollapsed));
    enableTreeDrag(row, ids, node.path);
    runtime.treeRows.set(key, { kind: 'suite', ids, parentKey, path: node.path, isCollapsed });
    fragment.appendChild(row);

    if (!isCollapsed) {
        getSortedChildren(node).forEach((child) => fragment.appendChild(showTreeNode(child, depth + 1, key)));
        node.tests.forEach((test) => fragment.appendChild(showTreeLeaf(test, depth + 1, key)));
    }

    return fragment;
}

/**
 * Handles keyboard navigation on the tree list (it holds the focus; rows are not tab stops).
 *
 * @param {KeyboardEvent} event - The keydown event.
 * @returns {void}
 */
function resolveTreeKey(event) {
    const keys = [...runtime.treeRows.keys()];

    if (keys.length === 0) {
        return;
    }

    const index = keys.indexOf(runtime.treeSelection);
    const current = runtime.treeRows.get(runtime.treeSelection);
    const select = (position) => setTreeSelection(keys[limitNumber(position, 0, keys.length - 1)]);

    switch (event.key) {
        case 'ArrowDown':
            select(index + 1);
            break;
        case 'ArrowUp':
            select(index === -1 ? keys.length - 1 : index - 1);
            break;
        case 'Home':
            select(0);
            break;
        case 'End':
            select(keys.length - 1);
            break;
        case 'ArrowRight':
            // Expand a collapsed suite; on an open suite, step into its first child.
            if (current?.kind === 'suite' && current.isCollapsed) {
                setTreeNodeCollapsed(current.path, false);
            } else if (current?.kind === 'suite') {
                select(index + 1);
            }
            break;
        case 'ArrowLeft':
            // Collapse an open suite; otherwise go up to the parent suite.
            if (current?.kind === 'suite' && !current.isCollapsed) {
                setTreeNodeCollapsed(current.path, true);
            } else if (current?.parentKey) {
                setTreeSelection(current.parentKey);
            }
            break;
        case 'Enter':
            if (current) {
                addTreeRowToPlan(current.ids);
            }
            break;
        case ' ':
            if (current?.kind === 'bot') {
                openTreeBot(current.test);
            } else if (current?.kind === 'suite') {
                setTreeNodeCollapsed(current.path, !current.isCollapsed);
            }
            break;
        default:
            return;
    }

    event.preventDefault();
}

/**
 * Selects the row a click landed on (the tree list keeps the focus for the keyboard).
 *
 * @param {MouseEvent} event - The click event on the tree list.
 * @returns {void}
 */
function selectTreeRowFromEvent(event) {
    const row = event.target.closest('.tree-row');

    if (row) {
        setTreeSelection(row.dataset.key);
    }
}

// Builds the element id of a row, for aria-activedescendant.
function getTreeRowElementId(key) {
    return `tree-row-${key.replace(/[^A-Za-z0-9_-]/g, '_')}`;
}

// Builds an icon span from TREE_ICONS.
function newTreeIcon(name, className) {
    const icon = document.createElement('span');

    icon.className = className;
    icon.innerHTML = TREE_ICONS[name];

    return icon;
}

// Builds the hover "+" button that adds the row's bots to the plan.
function newTreeAddButton(ids, label) {
    const button = document.createElement('button');

    button.type = 'button';
    button.className = 'tree-add';
    button.title = label;
    button.tabIndex = -1;
    button.setAttribute('aria-label', label);
    button.innerHTML = TREE_ICONS.add;
    button.addEventListener('click', (event) => {
        event.stopPropagation();
        addTreeRowToPlan(ids);
    });

    // A press on the button must not start a row drag.
    button.addEventListener('mousedown', (event) => event.stopPropagation());

    return button;
}

// Builds the tag chips: the first tag, then "+N" for the rest (the row title lists them all).
function newTreeChips(tags) {
    const chips = document.createElement('span');

    chips.className = 'tree-chips';

    if (tags.length === 0) {
        return chips;
    }

    const first = document.createElement('span');

    first.className = 'chip';
    first.textContent = tags[0];
    chips.append(first);

    if (tags.length > 1) {
        const more = document.createElement('span');

        more.className = 'chip chip-more';
        more.textContent = `+${tags.length - 1}`;
        chips.append(more);
    }

    return chips;
}

// Builds the name span.
function newTreeName(text) {
    const name = document.createElement('span');

    name.className = 'tree-name';
    name.textContent = text;

    return name;
}

// Builds a row with its indent guides; the selection and drag handlers attach later.
function newTreeRow(key, depth, kindClass) {
    const row = document.createElement('div');

    row.id = getTreeRowElementId(key);
    row.className = `tree-row ${kindClass}`;
    row.classList.toggle('selected', key === runtime.treeSelection);
    row.dataset.key = key;
    row.draggable = true;
    row.style.paddingLeft = `${TREE_PADDING + depth * TREE_INDENT}px`;
    row.setAttribute('role', 'treeitem');
    row.setAttribute('aria-level', String(depth + 1));
    row.setAttribute('aria-selected', String(key === runtime.treeSelection));

    // One guide per ancestor level, centered under that level's chevron.
    for (let level = 0; level < depth; level++) {
        const guide = document.createElement('span');

        guide.className = 'tree-guide';
        guide.style.left = `${TREE_PADDING + level * TREE_INDENT + 7}px`;
        row.append(guide);
    }

    return row;
}

// Builds the chevron-sized spacer that aligns bot icons with suite icons.
function newTreeSpacer() {
    const spacer = document.createElement('span');

    spacer.className = 'tree-chevron tree-chevron-spacer';

    return spacer;
}

// Builds the last-run status icon (empty for bots that have not run in this session).
function newTreeStatus(status) {
    const iconName = TREE_STATUS_ICONS[status];
    const holder = document.createElement('span');

    holder.className = `tree-status${iconName ? ` tree-status-${status}` : ''}`;

    if (iconName) {
        holder.innerHTML = TREE_ICONS[iconName];
        holder.setAttribute('aria-label', `Last run: ${getStatusLabel(status)}`);
    }

    return holder;
}

// Opens a bot in the G4 Workflow Editor (as text when the G4 Engine Client extension is missing).
async function openTreeBot(test) {
    try {
        const result = await g4Host.request('bots:open', { path: test.path });

        if (result?.editor === 'text') {
            writeLog(`${test.id} opened as text: install the G4 Engine Client extension to open bots in the Workflow Editor.`, 'muted');
        }
    } catch (error) {
        writeLog(`${test.id} could not be opened: ${error.message}`, 'fail');
    }
}

// Collapses or expands a suite and re-renders.
function setTreeNodeCollapsed(path, isCollapsed) {
    if (isCollapsed) {
        state.collapsedNodes.add(path);
    } else {
        state.collapsedNodes.delete(path);
    }

    showApp();
}

// Selects a row by key, without re-rendering the whole page, and scrolls it into view.
function setTreeSelection(key) {
    runtime.treeSelection = key || '';

    const list = elements['tree-list'];

    list.querySelectorAll('.tree-row.selected').forEach((row) => {
        row.classList.remove('selected');
        row.setAttribute('aria-selected', 'false');
    });

    const row = key ? document.getElementById(getTreeRowElementId(key)) : null;

    if (row) {
        row.classList.add('selected');
        row.setAttribute('aria-selected', 'true');
        row.scrollIntoView({ block: 'nearest' });
    }

    list.setAttribute('aria-activedescendant', row ? row.id : '');
}
