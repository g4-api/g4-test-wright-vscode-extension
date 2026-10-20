'use strict';

/*
 * Plan data: iterations of the whole suite and the data table of each plan item.
 *
 * Model:
 * - state.iterations holds one { include } entry per iteration. The whole suite runs once per
 *   included iteration, in plan order; with no iterations the plan runs once and each bot uses its
 *   own data source.
 * - Every plan item has a stable key, so several items of the same bot keep separate data.
 * - item.data holds one { column: value } row per iteration. Its columns are the bot's current
 *   {{$ columns.Name }} placeholders: a new placeholder adds a column and a removed one drops it. A
 *   bot without placeholders is static and runs unchanged in every iteration.
 * - New cells start from the bot's own data source when it has one, otherwise empty; a new
 *   iteration copies the values of the iteration it follows. A run with empty values is refused.
 *
 * runtime.botData caches each bot's columns and own rows by bot path ({ columns, rows, error }).
 */

// Type marker and version of a data file written by the iterations editor.
const DATA_FILE_TYPE = 'g4-test-wright-data';
const DATA_FILE_VERSION = 1;

// Most empty values listed in the console when a run is refused, so the log stays readable.
const MAXIMUM_LISTED_PROBLEMS = 5;

/**
 * Adds an iteration after another one, copying that iteration's values for every plan item.
 *
 * @param {number} afterIndex - Zero-based index of the iteration to copy; -1 copies the last one.
 * @returns {void}
 *
 * @remarks
 * Mutates state.iterations and the data of every plan item, so all tables keep the same number of
 * rows. The first iteration has nothing to copy: its cells start from each bot's own data source.
 */
function addIteration(afterIndex) {
    // Resolve the source iteration: the given one, or the last one when none is given.
    const sourceIndex = afterIndex >= 0 ? afterIndex : state.iterations.length - 1;
    const targetIndex = sourceIndex + 1;

    // Insert the copied row into every item's table, so every bot gets the new iteration.
    for (const item of state.plan) {
        const description = getBotData(item);
        const isStatic = !description || description.columns.length === 0;

        if (isStatic) {
            continue;
        }

        const sourceRow = item.data[sourceIndex] ?? newSeedRow(description, targetIndex);

        item.data.splice(targetIndex, 0, { ...sourceRow });
    }

    // Insert the iteration itself; it runs by default.
    state.iterations.splice(targetIndex, 0, { include: true });
}

/**
 * Returns the cached data description of a plan item's bot.
 *
 * @param {object} item - The plan item.
 * @returns {object|undefined} { columns, rows, error }, or undefined while the bot was not read yet.
 */
function getBotData(item) {
    return runtime.botData.get(getItemPath(item));
}

/**
 * Lists the empty values of the given plan items in the included iterations.
 *
 * @param {Array<object>} items - The plan items that are about to run.
 * @returns {Array<object>} One { item, position, iteration, column } entry per empty value.
 */
function getDataProblems(items) {
    const problems = [];

    // A plan without iterations sends no data, so it cannot have empty values.
    if (state.iterations.length === 0) {
        return problems;
    }

    for (const item of items) {
        const description = getBotData(item);
        const isStatic = !description || description.columns.length === 0;

        if (isStatic) {
            continue;
        }

        const position = state.plan.indexOf(item) + 1;

        // Check only included iterations: excluded ones never run.
        state.iterations.forEach((iteration, index) => {
            if (iteration.include === false) {
                return;
            }

            const row = item.data[index] ?? {};

            description.columns
                .filter((column) => (row[column] ?? '') === '')
                .forEach((column) => problems.push({ item, position, iteration: index + 1, column }));
        });
    }

    return problems;
}

/**
 * Returns the absolute bot file path of a plan item.
 *
 * @param {object} item - The plan item.
 * @returns {string} The bot path.
 */
function getItemPath(item) {
    return joinPath(item.folder || state.folderPath, item.testId);
}

/**
 * Returns the data rows a plan item sends with a run.
 *
 * @param {object} item - The plan item.
 * @returns {Array<object>} One row per iteration, or an empty array for a static bot.
 */
function getRunData(item) {
    const description = getBotData(item);
    const isStatic = !description || description.columns.length === 0;

    return isStatic ? [] : item.data.map((row) => ({ ...row }));
}

/**
 * Creates a stable plan item key.
 *
 * @returns {string} A random UUID.
 */
function newItemKey() {
    return crypto.randomUUID();
}

/**
 * Builds the starting row of a plan item in one iteration from its bot's own data source.
 *
 * @param {object} description - The bot's { columns, rows }.
 * @param {number} index - Zero-based iteration index.
 * @returns {object} A row with every column; a column the bot's data does not hold is empty.
 */
function newSeedRow(description, index) {
    const sourceRow = description.rows[index] ?? {};

    return Object.fromEntries(description.columns.map((column) => [column, sourceRow[column] ?? '']));
}

/**
 * Builds the model of the iterations sheet: one group per plan item that reads data.
 *
 * @returns {object} { iterations, groups } for <g4-data-sheet>.
 *
 * @remarks
 * Each group's rows array is the item's own data array, so the sheet edits the plan in place while
 * the user types, without a re-render.
 */
function newSheetModel() {
    const groups = [];

    state.plan.forEach((item, index) => {
        const description = getBotData(item);
        const isStatic = !description || description.columns.length === 0;

        if (isStatic) {
            return;
        }

        const suiteText = item.suite ? `${item.suite}/` : '';

        groups.push({
            key: item.key,
            title: `#${index + 1} ${item.name || item.testId}`,
            subtitle: `${suiteText}${item.file.split('/').pop()}`,
            columns: description.columns,
            rows: item.data
        });
    });

    return { iterations: state.iterations, groups };
}

/**
 * Applies one change reported by the iterations sheet.
 *
 * @param {g4-data-sheet} sheet - The sheet that reported the change.
 * @param {CustomEvent} event - g4-change { action, ... }.
 * @returns {void}
 */
function onDataSheetChange(sheet, event) {
    const change = event.detail;

    // Copies every value of one plan item into another item of the same bot; items that left the
    // plan while the editor was open are ignored. The target gets its own row objects.
    const copyItemData = (fromKey, toKey) => {
        const source = state.plan.find((item) => item.key === fromKey);
        const target = state.plan.find((item) => item.key === toKey);

        if (!source || !target) {
            return;
        }

        target.data = source.data.map((row) => ({ ...row }));
    };

    // Removes an iteration from the plan and from every item's table, so all tables stay in step.
    const removeIteration = (index) => {
        for (const item of state.plan) {
            if (index < item.data.length) {
                item.data.splice(index, 1);
            }
        }

        state.iterations.splice(index, 1);
    };

    // A cell edit already changed the item's row in place: only save, so typing keeps its focus.
    if (change.action === 'value') {
        requestSave();
        showPlan();

        return;
    }

    // Apply a structural change to the plan, then render the sheet and the page again.
    switch (change.action) {
        case 'add':
            addIteration(-1);
            break;
        case 'duplicate':
            addIteration(change.iteration);
            break;
        case 'remove':
            removeIteration(change.iteration);
            break;
        case 'include':
            state.iterations[change.iteration].include = change.value === true;
            break;
        case 'copy':
            copyItemData(change.from, change.to);
            break;
        default:
            return;
    }

    sheet.model = newSheetModel();
    showApp();
}

/**
 * Opens the iterations editor over the page.
 *
 * @param {string} [focusKey] - Key of a plan item whose columns get the focus.
 * @returns {Promise<void>}
 *
 * @remarks
 * Reads the bots again first, so the columns reflect the bots as they are now.
 */
async function openDataEditor(focusKey = '') {
    // Builds a header tool button of the editor, marked for the modal's header tools.
    const newEditorButton = (options) => {
        const button = document.createElement('button');

        button.type = 'button';
        button.className = 'btn btn-ghost btn-sm';
        button.textContent = options.label;
        button.title = options.title;
        button.dataset.slot = 'tools';
        button.dataset.testId = options.testId;

        return button;
    };

    // Import replaces the values, then the sheet renders the plan again.
    const onImportClick = async () => {
        await readDataFile();
        sheet.model = newSheetModel();
    };

    // Read every plan bot again, so columns added or removed in the bot files show at once.
    await updateDataColumns({ isRefreshing: true });

    const modal = document.createElement('g4-modal');
    const sheet = document.createElement('g4-data-sheet');
    const importButton = newEditorButton({ label: 'Import', title: 'Import iterations from a data file', testId: 'import-data-button' });
    const exportButton = newEditorButton({ label: 'Export', title: 'Export the iterations to a data file', testId: 'export-data-button' });
    const focusReturn = document.activeElement;

    // Build the modal: the sheet as content, Import and Export as header tools.
    modal.setAttribute('modal-title', 'Iterations');
    modal.setAttribute('size', 'editor');
    modal.setAttribute('test-id', 'iterations-editor');
    sheet.setAttribute('test-id', 'iterations-sheet');
    modal.append(importButton, exportButton, sheet);

    // Apply sheet changes to the plan, and wire the import and export tools.
    sheet.addEventListener('g4-change', (event) => onDataSheetChange(sheet, event));

    importButton.addEventListener('click', onImportClick);

    exportButton.addEventListener('click', saveDataFile);

    // Show the modal, render the sheet, and put the cursor in the requested item's columns.
    modal.show(focusReturn instanceof HTMLElement ? focusReturn : null);
    sheet.model = newSheetModel();

    if (focusKey) {
        sheet.focusGroup(focusKey);
    }
}

/**
 * Imports iterations from a data file, replacing the current values.
 *
 * @returns {Promise<void>}
 *
 * @remarks
 * Items match by key (the same plan), otherwise by position and bot id (another plan). Values are
 * reduced to each item's current columns; items the file does not hold start from their bots' data.
 */
async function readDataFile() {
    // Matches a file entry to a plan item: by key first, then by position and bot id.
    const findItem = (key, entry) => {
        const byKey = state.plan.find((item) => item.key === key);

        if (byKey) {
            return byKey;
        }

        const byPosition = state.plan[(entry?.position ?? 0) - 1];
        const isSameBot = byPosition?.testId === entry?.testId;

        return isSameBot ? byPosition : undefined;
    };

    const result = await g4Host.request('data:load');

    // Stop on cancel or an invalid file, with the reason in the console.
    if (!result || result.canceled) {
        writeLog('Import iterations canceled.', 'muted');

        return;
    }

    if (result.error) {
        writeLog(`Import failed: ${result.error}`, 'fail');

        return;
    }

    const source = result.filePath.split(PATH_SEPARATOR_PATTERN).pop();
    const fileIterations = Array.isArray(result.data?.iterations) ? result.data.iterations : [];
    const matchedKeys = new Set();
    const unmatchedEntries = new Set();

    // Replace the iterations, then rebuild every item's table from the file.
    state.iterations = fileIterations.map((iteration) => ({ include: iteration?.include !== false }));
    state.plan.forEach((item) => {
        item.data = [];
    });

    fileIterations.forEach((iteration, index) => {
        for (const [key, entry] of Object.entries(iteration?.items ?? {})) {
            const item = findItem(key, entry);

            if (!item) {
                unmatchedEntries.add(`#${entry?.position ?? '?'} ${entry?.testId ?? key}`);
                continue;
            }

            matchedKeys.add(item.key);
            item.data[index] = { ...(entry?.values ?? {}) };
        }
    });

    // Fill rows the file left out and drop columns the bots no longer read.
    updatePlanData();
    showApp();

    // Report what was matched, so values that did not land are never lost silently.
    writeLog(`Iterations imported: ${source} (${state.iterations.length} iteration(s), ${matchedKeys.size} plan item(s)).`, 'info');

    if (unmatchedEntries.size > 0) {
        writeLog(`Not in this plan, skipped: ${[...unmatchedEntries].join(', ')}.`, 'warn');
    }
}

/**
 * Exports the iterations through the native save dialog.
 *
 * @returns {Promise<void>}
 */
async function saveDataFile() {
    // Build the data file: every iteration with the values of every plan item that reads data, by
    // key, with its position and bot id so another plan can match it.
    const iterations = state.iterations.map((iteration, index) => {
        const items = {};

        state.plan.forEach((item, position) => {
            const description = getBotData(item);
            const isStatic = !description || description.columns.length === 0;

            if (isStatic) {
                return;
            }

            items[item.key] = { position: position + 1, testId: item.testId, values: { ...(item.data[index] ?? {}) } };
        });

        return { include: iteration.include !== false, items };
    });

    const data = { type: DATA_FILE_TYPE, version: DATA_FILE_VERSION, savedAt: new Date().toISOString(), iterations };
    const timeText = data.savedAt.replaceAll(':', '-').replaceAll('.', '-');

    // Ask for the target file; the host writes it.
    const result = await g4Host.request('data:save', { data, defaultName: `g4-data-${timeText}.json` });

    if (!result || result.canceled) {
        writeLog('Export iterations canceled.', 'muted');

        return;
    }

    writeLog(`Iterations exported: ${result.filePath} (${data.iterations.length} iteration(s)).`, 'info');
}

/**
 * Tests whether the given plan items can run with the plan's data, and explains why not.
 *
 * @param {Array<object>} items - The plan items about to run.
 * @returns {Promise<boolean>} True when the run may start.
 *
 * @remarks
 * Reads the bots again first, so the check uses their current columns. A refused run logs the empty
 * values and opens the iterations editor at the first one.
 */
async function testRunData(items) {
    // Read the bots again, so the check and the run use the columns the bot files hold now.
    await updateDataColumns({ isRefreshing: true });

    // Refuse a plan whose iterations are all excluded: nothing would run.
    const hasIterations = state.iterations.length > 0;
    const isAllExcluded = hasIterations && state.iterations.every((iteration) => iteration.include === false);

    if (isAllExcluded) {
        writeLog('Every iteration is excluded: include at least one iteration to run the plan.', 'warn');

        return false;
    }

    // Refuse empty values: the engine would insert them as empty text without telling.
    const problems = getDataProblems(items);

    if (problems.length === 0) {
        return true;
    }

    const listedText = problems
        .slice(0, MAXIMUM_LISTED_PROBLEMS)
        .map((problem) => `#${problem.position} ${problem.item.name} iteration ${problem.iteration} '${problem.column}'`)
        .join(', ');
    const hiddenCount = problems.length - MAXIMUM_LISTED_PROBLEMS;
    const moreText = hiddenCount > 0 ? `, and ${hiddenCount} more` : '';

    writeLog(`Run refused: ${problems.length} empty value(s) to fill: ${listedText}${moreText}.`, 'warn');
    await openDataEditor(problems[0].item.key);

    return false;
}

/**
 * Reads the columns and own rows of the plan's bots, then aligns every item's table with them.
 *
 * @param {object} [options] - { isRefreshing }: true reads every bot again, false reads new bots only.
 * @returns {Promise<void>}
 *
 * @remarks
 * A bot that cannot be read keeps its item's values untouched, so a missing file never wipes data.
 */
async function updateDataColumns({ isRefreshing = false } = {}) {
    // Pick the bots to read: all of them on a refresh, otherwise only bots not read yet.
    const paths = [...new Set(state.plan.map(getItemPath))];
    const pendingPaths = isRefreshing ? paths : paths.filter((botPath) => !runtime.botData.has(botPath));

    // Ask the host to read the bots; a failed request keeps the cached descriptions.
    if (pendingPaths.length > 0) {
        try {
            const result = await g4Host.request('data:find', { paths: pendingPaths });

            for (const [botPath, description] of Object.entries(result?.bots ?? {})) {
                runtime.botData.set(botPath, description);
            }
        } catch (error) {
            writeLog(`Bot columns could not be read: ${error.message}`, 'warn');
        }
    }

    // Align every item's table with its bot's current columns, then show the result.
    updatePlanData();
    showApp();
}

/**
 * Aligns every plan item with the plan: a key, and one row per iteration holding exactly its bot's
 * current columns.
 *
 * @returns {void}
 *
 * @remarks
 * Mutates the plan items in place. Missing rows copy the item's last row, or start from the bot's
 * own data source; new columns start from the bot's data or empty; removed columns are dropped.
 * Items whose bot was not read, or could not be read, keep their rows as they are.
 */
function updatePlanData() {
    const usedKeys = new Set();

    // Converts a stored value into cell text: text as it is, numbers and booleans as written, and
    // anything else (an object from a hand-edited file) as JSON instead of '[object Object]'.
    const convertToCellText = (value) => {
        if (value === null || value === undefined) {
            return '';
        }

        if (typeof value === 'string') {
            return value;
        }

        const isPrimitive = typeof value === 'number' || typeof value === 'boolean';

        return isPrimitive ? String(value) : JSON.stringify(value);
    };

    for (const item of state.plan) {
        // Give every item a unique key; a key seen twice (a plan appended to itself) is replaced.
        const isKeyUsable = Boolean(item.key) && !usedKeys.has(item.key);

        if (!isKeyUsable) {
            item.key = newItemKey();
        }

        usedKeys.add(item.key);
        item.data = Array.isArray(item.data) ? item.data : [];

        // Leave the rows of an unread or unreadable bot untouched, so a missing file never wipes data.
        const description = getBotData(item);
        const isUnread = !description;
        const isUnreadable = !isUnread && description.error !== '' && description.columns.length === 0;

        if (isUnread || isUnreadable) {
            continue;
        }

        // A static bot keeps no rows: it runs unchanged in every iteration.
        const isStatic = description.columns.length === 0;
        const hasIterations = state.iterations.length > 0;

        if (isStatic || !hasIterations) {
            item.data = [];
            continue;
        }

        // Rebuild one row per iteration from the existing rows, copying the last row for new ones.
        const rows = [];

        for (let index = 0; index < state.iterations.length; index++) {
            const existingRow = item.data[index] ?? rows[index - 1] ?? newSeedRow(description, index);
            const seedRow = description.rows[index] ?? {};
            const valuesByName = new Map(Object.entries(existingRow).map(([name, value]) => [name.toLowerCase(), value]));

            // Keep exactly the bot's columns: matched case-insensitively, a new one from the bot's data or empty.
            rows.push(Object.fromEntries(description.columns.map((column) => [
                column,
                convertToCellText(valuesByName.get(column.toLowerCase()) ?? seedRow[column])
            ])));
        }

        item.data = rows;
    }
}
