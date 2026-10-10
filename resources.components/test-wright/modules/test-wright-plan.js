'use strict';

/*
 * Testing plan: rows, drag-and-drop (add, reorder, load files/reports/schedules), status, counts,
 * and the enabled state of the action buttons.
 */

/**
 * Handles a drop on the plan: load a plan file, report, or schedule; reorder; or add bots.
 *
 * @param {DragEvent} event - The drop event.
 * @returns {void}
 */
function addDroppedTests(event) {
    if (!runtime.dragPayload) {
        return;
    }

    event.preventDefault();

    const payload = runtime.dragPayload;

    runtime.dragPayload = null;
    clearPlanDropMarkers();

    if (payload.kind === 'planFile') {
        readPlanFromRepo(payload.path);
    } else if (payload.kind === 'report') {
        loadReportIntoPlan(payload.path);
    } else if (payload.kind === 'schedulePlan') {
        loadSchedulePlan(payload.items, payload.label, payload.testParallel);
    } else if (payload.kind === 'plan') {
        movePlanItem(payload.uid, getPlanDropIndex(event.clientY));
    } else if (payload.kind === 'tests') {
        addTestsToPlan(payload.ids, getPlanDropIndex(event.clientY));
    }
}

/**
 * Inserts new plan items (duplicates allowed) at an index.
 *
 * @param {string[]} ids - The bot ids to add.
 * @param {number} [atIndex] - The insertion index (default: end of plan).
 * @returns {void}
 */
function addTestsToPlan(ids, atIndex = state.plan.length) {
    state.plan.splice(atIndex, 0, ...ids.map(newPlanItem));
    showApp();
}

/**
 * Clears the entire plan (after confirmation).
 *
 * @returns {Promise<void>}
 */
async function clearPlan() {
    if (state.plan.length === 0) {
        return;
    }

    const isConfirmed = await confirmDialog({
        title: 'Clear plan',
        message: `This removes ${state.plan.length === 1 ? 'the only item' : `all ${state.plan.length} items`} from the plan and cannot be undone. Consider exporting or saving the plan first. Continue?`,
        confirmLabel: 'Clear plan'
    });

    if (!isConfirmed) {
        return;
    }

    state.plan = [];
    showApp();
}

/**
 * Clears all plan drop indicators.
 *
 * @returns {void}
 */
function clearPlanDropMarkers() {
    elements['plan-list'].classList.remove('drag-over');
    elements['plan-list'].querySelectorAll('.plan-row').forEach((row) => row.classList.remove('drop-before', 'drop-after'));
}

/**
 * Returns the checked plan items.
 *
 * @returns {Array<object>} The checked items.
 */
function getCheckedPlanItems() {
    return state.plan.filter((item) => item.checked);
}

/**
 * Returns the plan index where a drop at a Y coordinate lands.
 *
 * @param {number} clientY - The pointer's Y coordinate.
 * @returns {number} The target index (0..rows.length).
 */
function getPlanDropIndex(clientY) {
    const rows = [...elements['plan-list'].querySelectorAll('.plan-row')];

    for (let index = 0; index < rows.length; index++) {
        const rect = rows[index].getBoundingClientRect();

        if (clientY < rect.top + rect.height / 2) {
            return index;
        }
    }

    return rows.length;
}

/**
 * Moves a plan item to a new index.
 *
 * @param {number} uid - The item's uid.
 * @param {number} atIndex - The destination index.
 * @returns {void}
 */
function movePlanItem(uid, atIndex) {
    const from = state.plan.findIndex((item) => item.uid === uid);

    if (from === -1) {
        return;
    }

    const [item] = state.plan.splice(from, 1);

    // Removing an earlier element shifts the target left by one.
    const target = from < atIndex ? atIndex - 1 : atIndex;

    state.plan.splice(limitNumber(target, 0, state.plan.length), 0, item);
    showApp();
}

/**
 * Builds a self-contained plan item from a bot id (it no longer depends on the tree afterwards).
 *
 * @param {string} testId - The bot id.
 * @returns {object} The new plan item.
 */
function newPlanItem(testId) {
    const test = findTest(testId) || {};

    return {
        uid: runtime.nextUid++,
        testId,
        status: 'not-run',
        checked: true,
        name: test.name || testId.split('/').pop().replace(/\.(json|g4|g4bot)$/i, ''),
        file: test.file || testId,
        suite: test.suite ?? testId.split('/').slice(0, -1).join('/'),
        tags: Array.isArray(test.tags) ? test.tags : [],
        folder: state.folderPath
    };
}

/**
 * Sets a plan item's status by uid (no-op when the row is gone).
 *
 * @param {number} uid - The plan item's uid.
 * @param {string} status - The new status.
 * @returns {void}
 */
function setPlanStatus(uid, status) {
    const item = state.plan.find((candidate) => candidate.uid === uid);

    if (item) {
        item.status = status;
    }
}

/**
 * Updates the enabled state of the action buttons.
 *
 * @returns {void}
 */
function showButtons() {
    const isRunning = runtime.activeRuns > 0;
    const hasFolder = Boolean(state.folderPath);
    const hasChecked = getCheckedPlanItems().length > 0;
    const isScheduleValid = testFutureDateTime(elements['input-schedule'].value);
    const isScheduleFull = state.scheduledRuns.length >= runtime.maximumSchedules;

    elements['btn-discover'].disabled = !hasFolder || state.status === 'discovering';
    elements['btn-run'].disabled = !hasChecked || isRunning;
    elements['btn-clear-plan'].disabled = state.plan.length === 0 || isRunning;
    elements['btn-export-plan'].disabled = state.plan.length === 0;
    elements['btn-save-plan-repo'].disabled = state.plan.length === 0;
    elements['btn-clear-tree'].disabled = state.tests.length === 0 || isRunning;
    elements['btn-schedule'].disabled = !hasChecked || !isScheduleValid || isScheduleFull;
    elements['btn-stop'].disabled = runtime.activeRunIds.size === 0;
}

/**
 * Updates the count badges (discovered, visible, plan, checked).
 *
 * @returns {void}
 */
function showCounts() {
    elements['count-total'].textContent = state.tests.length;
    elements['count-visible'].textContent = getVisibleTests().length;
    elements['count-plan'].textContent = state.plan.length;
    elements['count-checked'].textContent = getCheckedPlanItems().length;

    // The label after the plan count follows it: "1 item", "2 items".
    elements['count-plan'].nextSibling.textContent = state.plan.length === 1 ? ' item' : ' items';
}

/**
 * Renders the plan list (or its empty drop zone) and the Parallel Tests toggle.
 *
 * @returns {void}
 */
function showPlan() {
    elements['toggle-parallel-tests'].value = state.planParallel;

    const list = elements['plan-list'];

    list.replaceChildren();

    if (state.plan.length === 0) {
        const zone = document.createElement('div');

        zone.className = 'plan-empty';
        zone.dataset.testId = 'plan-empty-drop-zone';
        zone.innerHTML = '<div>Drag bots or suites here to build a run plan.</div><small>They run top to bottom, in this order.</small>';
        list.appendChild(zone);

        return;
    }

    state.plan.forEach((item, index) => list.appendChild(showPlanRow(item, index)));
}

/**
 * Shows the drop indicator as the pointer drags over the plan.
 *
 * @param {DragEvent} event - The dragover event.
 * @returns {void}
 */
function showPlanDropMarker(event) {
    if (!runtime.dragPayload) {
        return;
    }

    event.preventDefault();
    elements['plan-list'].classList.add('drag-over');

    // A dropped plan file, report, or schedule loads a whole plan: no row markers.
    if (['planFile', 'report', 'schedulePlan'].includes(runtime.dragPayload.kind)) {
        event.dataTransfer.dropEffect = 'copy';

        return;
    }

    event.dataTransfer.dropEffect = runtime.dragPayload.kind === 'plan' ? 'move' : 'copy';

    const rows = [...elements['plan-list'].querySelectorAll('.plan-row')];
    const index = getPlanDropIndex(event.clientY);

    rows.forEach((row) => row.classList.remove('drop-before', 'drop-after'));

    if (rows.length === 0) {
        return;
    }

    if (index < rows.length) {
        rows[index].classList.add('drop-before');
    } else {
        rows.at(-1).classList.add('drop-after');
    }
}

/**
 * Renders one plan row from the item's own data (independent of the tree).
 *
 * @param {object} item - The plan item.
 * @param {number} index - The zero-based position.
 * @returns {HTMLElement} The row.
 */
function showPlanRow(item, index) {
    const row = document.createElement('div');
    const isRunning = item.status === 'running';
    const suiteText = item.suite ? `${item.suite}/` : '';

    row.className = 'plan-row';
    row.draggable = true;
    row.dataset.uid = item.uid;
    row.dataset.testId = `plan-row-${index + 1}`;
    row.innerHTML =
        '<span class="plan-handle" title="Drag to reorder">&#8285;</span>' +
        '<input type="checkbox" class="plan-check" aria-label="Include in the run">' +
        `<span class="plan-order">${index + 1}</span>` +
        '<div class="plan-main"><span class="plan-name"></span><span class="plan-path"></span></div>' +
        `<span class="badge badge-${getEscapedHtml(item.status)}"${isRunning ? ' title="Running"' : ''}></span>` +
        '<button type="button" class="plan-remove" title="Remove" aria-label="Remove from plan">&times;</button>';

    row.querySelector('.plan-name').textContent = item.name || item.testId;
    row.querySelector('.plan-path').textContent = `${suiteText}${item.file.split('/').pop()}`;
    row.title = `${item.name}\n${item.testId}${item.message ? `\n${item.message}` : ''}`;

    const badge = row.querySelector('.badge');

    if (isRunning) {
        badge.innerHTML = '<span class="run-dots"><span></span><span></span><span></span></span>';
    } else {
        badge.textContent = getStatusLabel(item.status);
    }

    const check = row.querySelector('.plan-check');

    check.checked = item.checked;
    check.addEventListener('change', () => {
        item.checked = check.checked;
        showCounts();
        showButtons();
        requestSave();
    });

    row.querySelector('.plan-remove').addEventListener('click', () => {
        state.plan = state.plan.filter((other) => other.uid !== item.uid);
        showApp();
    });

    // Reordering: dragging a plan row carries its uid.
    row.addEventListener('dragstart', (event) => {
        runtime.dragPayload = { kind: 'plan', uid: item.uid };
        event.dataTransfer.effectAllowed = 'move';
        event.dataTransfer.setData('text/plain', String(item.uid));
        row.classList.add('dragging');
    });

    row.addEventListener('dragend', () => {
        row.classList.remove('dragging');
        runtime.dragPayload = null;
        clearPlanDropMarkers();
    });

    return row;
}

/**
 * Scrolls the plan so a row (if present) is visible.
 *
 * @param {number} uid - The plan item's uid.
 * @returns {void}
 */
function showPlanRowInView(uid) {
    elements['plan-list'].querySelector(`.plan-row[data-uid="${uid}"]`)?.scrollIntoView({ block: 'nearest' });
}
