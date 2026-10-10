'use strict';

/*
 * Plan files: export/import through native dialogs, the JSON model (g4-test-wright-plan), and the
 * plans repository.
 */

const PLAN_FILE_TYPE = 'g4-test-wright-plan';
const PLAN_FILE_VERSION = 1;
const PLAN_JSON_EXTENSION_PATTERN = /\.json$/i;
const PLAN_NAME_FORBIDDEN_CHARACTER_PATTERN = /[\\/:*?"<>|]/g;
const PATH_SEPARATOR_PATTERN = /[\\/]/;
const TIMESTAMP_FILE_SEPARATOR_PATTERN = /[:.]/g;

/**
 * Appends a loaded file's items to the plan.
 *
 * @param {object} plan - The parsed plan file.
 * @param {string} source - A label for logs.
 * @returns {void}
 */
function addLoadedPlan(plan, source) {
    const items = getPlanItemsFromFile(plan);

    if (!items) {
        writeLog('Load failed: not a valid Test Wright plan file.', 'fail');

        return;
    }

    state.plan.push(...items);
    writeLog(`Plan appended: ${source} (+${items.length} items).`, 'info');
    showApp();
}

/**
 * Builds the default plan file name (no extension).
 *
 * @returns {string} For example "g4-plan-2026-10-08T14-30-05-123Z".
 */
function getDefaultPlanName() {
    return `g4-plan-${new Date().toISOString().replace(TIMESTAMP_FILE_SEPARATOR_PATTERN, '-')}`;
}

/**
 * Maps a plan file's items into live plan rows (fresh uids).
 *
 * @param {object} plan - The parsed plan file.
 * @returns {Array<object>|null} The rows, or null when the file is not a plan.
 */
function getPlanItemsFromFile(plan) {
    if (!plan || plan.type !== PLAN_FILE_TYPE || !Array.isArray(plan.items)) {
        return null;
    }

    return plan.items.map((item) => ({
        uid: runtime.nextUid++,
        testId: item.testId,
        status: 'not-run',
        checked: item.checked !== false,
        name: item.name || item.testId,
        file: item.file || item.testId,
        suite: item.suite || '',
        tags: Array.isArray(item.tags) ? item.tags : [],
        folder: item.folder || plan.folderPath || state.folderPath
    }));
}

/**
 * Converts plan rows into portable plan-file items.
 *
 * @param {Array<object>} items - The rows.
 * @returns {Array<object>} The file items.
 */
function newPlanFileItems(items) {
    return items.map((item) => ({
        testId: item.testId,
        name: item.name || '',
        file: item.file || item.testId,
        suite: item.suite || '',
        tags: Array.isArray(item.tags) ? item.tags : [],
        checked: Boolean(item.checked),
        folder: item.folder || state.folderPath
    }));
}

/**
 * Creates a portable snapshot of the current plan.
 *
 * @returns {object} The g4-test-wright-plan object.
 */
function newPlanJson() {
    return {
        type: PLAN_FILE_TYPE,
        version: PLAN_FILE_VERSION,
        savedAt: new Date().toISOString(),
        folderPath: state.folderPath,
        parallel: state.planParallel,
        items: newPlanFileItems(state.plan)
    };
}

/**
 * Imports a plan from a file (replace mode, confirming before discarding a plan).
 *
 * @returns {Promise<void>}
 */
async function readPlan() {
    const result = await g4Host.request('plans:load');

    if (!result || result.canceled) {
        writeLog('Import plan canceled.', 'muted');

        return;
    }

    if (result.error) {
        writeLog(`Import failed: ${result.error}`, 'fail');

        return;
    }

    const source = result.filePath.split(PATH_SEPARATOR_PATTERN).pop();

    if (state.plan.length > 0) {
        const isConfirmed = await confirmDialog({
            title: 'Replace plan',
            message: `Replace the current plan with "${source}"?`,
            confirmLabel: 'Replace'
        });

        if (!isConfirmed) {
            writeLog('Import plan canceled.', 'muted');

            return;
        }
    }

    setLoadedPlan(result.plan, source);
}

/**
 * Loads a plan file from the repository (append or replace).
 *
 * @param {string} filePath - The plan file path.
 * @returns {Promise<void>}
 */
async function readPlanFromRepo(filePath) {
    const result = await g4Host.request('plans:read', { path: filePath });

    if (!result || result.error) {
        writeLog(`Load failed: ${result?.error || 'unknown error'}`, 'fail');

        return;
    }

    const source = filePath.split(PATH_SEPARATOR_PATTERN).pop();

    if (state.appendMode) {
        addLoadedPlan(result.plan, source);

        return;
    }

    if (state.plan.length > 0) {
        const isConfirmed = await confirmDialog({
            title: 'Replace plan',
            message: `Replace the current plan with "${source}"?`,
            confirmLabel: 'Replace'
        });

        if (!isConfirmed) {
            return;
        }
    }

    setLoadedPlan(result.plan, source);
}

/**
 * Exports the plan through the native save dialog.
 *
 * @returns {Promise<void>}
 */
async function savePlan() {
    const planJson = newPlanJson();
    const result = await g4Host.request('plans:save', { plan: planJson, defaultName: `${getDefaultPlanName()}.json` });

    if (!result || result.canceled) {
        writeLog('Export plan canceled.', 'muted');

        return;
    }

    writeLog(`Plan exported: ${result.filePath} (${planJson.items.length} items).`, 'info');
}

/**
 * Saves the plan into the plans repository folder under a prompted name.
 *
 * @returns {Promise<void>}
 */
async function savePlanToRepo() {
    if (state.plan.length === 0) {
        writeLog('Nothing to save: the plan is empty.', 'warn');

        return;
    }

    const repositoryFolder = state.repoFolderPath || runtime.defaults.plansFolder;

    if (!repositoryFolder) {
        writeLog('Open a workspace folder or select a plans folder first.', 'warn');

        return;
    }

    const planName = await promptDialog({
        title: 'Save plan to repository',
        message: `Saving into ${repositoryFolder}`,
        defaultValue: getDefaultPlanName(),
        confirmLabel: 'Save'
    });

    if (planName === null) {
        writeLog('Save to repository canceled.', 'muted');

        return;
    }

    let fileName = planName.replace(PLAN_NAME_FORBIDDEN_CHARACTER_PATTERN, '_') || getDefaultPlanName();

    if (!PLAN_JSON_EXTENSION_PATTERN.test(fileName)) {
        fileName += '.json';
    }

    try {
        const request = { plan: newPlanJson(), folderPath: repositoryFolder, fileName };
        let result = await g4Host.request('plans:saveToFolder', request);

        // The host does not replace an existing plan until the user agrees.
        if (result?.exists) {
            const isConfirmed = await confirmDialog({
                title: 'Replace saved plan',
                message: `A plan named "${fileName}" is already in the repository. Replace it with the current plan?`,
                confirmLabel: 'Replace'
            });

            if (!isConfirmed) {
                writeLog('Save to repository canceled.', 'muted');

                return;
            }

            result = await g4Host.request('plans:saveToFolder', { ...request, overwrite: true });
        }

        writeLog(`Plan saved to repository: ${result.filePath} (${state.plan.length} items).`, 'info');

        // The repository shows the folder it was saved to, so the new plan is visible.
        if (!state.repoFolderPath) {
            state.repoFolderPath = repositoryFolder;
        }

        if (state.repoFolderPath === repositoryFolder) {
            await updateRepo();
        }
    } catch (error) {
        writeLog(`Save to repository failed: ${error.message}`, 'fail');
    }
}

/**
 * Prompts for a plans folder and lists its plans.
 *
 * @returns {Promise<void>}
 */
async function selectPlansFolder() {
    const folder = await g4Host.request('app:selectFolder', {
        title: 'Select the plans repository folder',
        defaultPath: state.repoFolderPath || runtime.defaults.plansFolder || runtime.defaults.projectFolder
    });

    if (!folder) {
        return;
    }

    state.repoFolderPath = folder;
    writeLog(`Plans folder selected: ${folder}`, 'info');
    await updateRepo();
}

/**
 * Replaces the plan with a loaded file's contents.
 *
 * @param {object} plan - The parsed plan file.
 * @param {string} source - A label for logs.
 * @returns {void}
 */
function setLoadedPlan(plan, source) {
    const items = getPlanItemsFromFile(plan);

    if (!items) {
        writeLog('Load failed: not a valid Test Wright plan file.', 'fail');

        return;
    }

    state.plan = items;
    state.planParallel = Boolean(plan.parallel);
    writeLog(`Plan loaded: ${source} (${items.length} items).`, 'info');
    showApp();
}

/**
 * Renders the plans repository (folder header, controls, and list).
 *
 * @returns {void}
 */
function showRepo() {
    elements['repo-folder'].textContent = state.repoFolderPath || 'No folder selected';
    elements['btn-select-plans-folder'].title = state.repoFolderPath ? `Plans folder: ${state.repoFolderPath}` : 'Select plans folder';
    elements['btn-refresh-plans'].disabled = !state.repoFolderPath;
    elements['toggle-plans-append'].value = state.appendMode;

    const list = elements['repo-list'];

    if (!state.repoFolderPath) {
        list.innerHTML = writeEmptyState('folder', 'No plans folder', 'Select a folder to list saved plans.');

        return;
    }

    if (state.repoPlans.length === 0) {
        list.innerHTML = writeEmptyState('search', 'No plans found', 'Save a plan to the repository, then Refresh.');

        return;
    }

    list.replaceChildren(...state.repoPlans.map(showRepoItem));
}

/**
 * Renders one saved plan (drag onto the plan, or double-click, to load).
 *
 * @param {object} plan - { fileName, relativePath, itemCount, path }.
 * @returns {HTMLElement} The row.
 */
function showRepoItem(plan) {
    const item = document.createElement('div');
    const main = document.createElement('div');
    const name = document.createElement('span');
    const relativePath = document.createElement('span');
    const count = document.createElement('span');

    item.className = 'repo-item';
    item.draggable = true;
    item.title = 'Drag onto the plan, or double-click, to load';
    item.dataset.testId = `plan-file-${plan.fileName}`;
    main.className = 'repo-item-main';
    name.className = 'repo-item-name';
    name.textContent = plan.fileName.replace(PLAN_JSON_EXTENSION_PATTERN, '');
    relativePath.className = 'repo-item-path';
    relativePath.textContent = plan.relativePath;
    count.className = 'repo-item-count';
    count.textContent = String(plan.itemCount);
    main.append(name, relativePath);
    item.append(main, count);

    item.addEventListener('dragstart', (event) => {
        runtime.dragPayload = { kind: 'planFile', path: plan.path };
        event.dataTransfer.effectAllowed = 'copy';
        event.dataTransfer.setData('text/plain', plan.path);
        item.classList.add('dragging');
    });

    item.addEventListener('dragend', () => {
        item.classList.remove('dragging');
        runtime.dragPayload = null;
        clearPlanDropMarkers();
    });

    item.addEventListener('dblclick', () => readPlanFromRepo(plan.path));

    return item;
}

/**
 * Re-scans the plans folder.
 *
 * @returns {Promise<void>}
 */
async function updateRepo() {
    if (!state.repoFolderPath) {
        return;
    }

    try {
        const result = await g4Host.request('plans:list', { folderPath: state.repoFolderPath });

        state.repoPlans = Array.isArray(result?.plans) ? result.plans : [];
    } catch (error) {
        state.repoPlans = [];
        writeLog(`Plans scan error: ${error.message}`, 'warn');
    }

    writeLog(`${state.repoPlans.length} plan(s) found in the repository.`, 'muted');
    showApp();
}
