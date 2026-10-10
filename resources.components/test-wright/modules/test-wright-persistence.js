'use strict';

/*
 * Persistence: the session snapshot (folders, toggles, plan, filters, layout) kept in the
 * workspace state, restore on open, and a debounced autosave. Schedules are kept by the host.
 */

/**
 * Builds the persisted session snapshot.
 *
 * @returns {object} The serializable session.
 */
function newStateSnapshot() {
    return {
        version: 1,
        folderPath: state.folderPath,
        environment: state.environment,
        repoFolderPath: state.repoFolderPath,
        reportsFolderPath: state.reportsFolderPath,
        allureFolderPath: state.allureFolderPath,
        allureEnabled: state.allureEnabled,
        allureOpenInBrowser: state.allureOpenInBrowser,
        appendMode: state.appendMode,
        reportsAppendMode: state.reportsAppendMode,
        planParallel: state.planParallel,
        collapsedSections: [...state.collapsedSections],
        accordionSizes: state.accordionSizes,
        filterText: state.filterText,
        selectedTags: [...state.selectedTags],
        plan: newPlanFileItems(state.plan),
        ui: {
            sidebarW: runtime.uiSidebarW,
            repoW: runtime.uiRepoW,
            splitTreeW: runtime.uiSplitTreeW,
            consoleOpen: state.consoleOpen,
            consoleHeight: runtime.consoleHeightPx,
            showSidebar: state.showSidebar,
            showRepo: state.showRepo,
            collapsedNodes: [...state.collapsedNodes]
        }
    };
}

/**
 * Requests a debounced save (ignored until the initial restore finishes).
 *
 * @returns {void}
 */
function requestSave() {
    if (!runtime.ready) {
        return;
    }

    clearTimeout(runtime.saveTimer);
    runtime.saveTimer = setTimeout(saveSession, 500);
}

/**
 * Restores the saved session (or the project defaults), then discovers and scans the folders.
 *
 * @returns {Promise<void>}
 */
async function restoreSession() {
    let saved = null;

    try {
        saved = (await g4Host.request('state:load'))?.state ?? null;
    } catch {
        // Fall through to the defaults.
    }

    const defaults = runtime.defaults;
    const ui = saved?.ui || {};

    // A first open (no saved session) starts from the G4 project layout.
    state.folderPath = saved?.folderPath ?? defaults.botsFolder ?? '';
    state.environment = saved?.environment || '';
    state.repoFolderPath = saved?.repoFolderPath ?? defaults.plansFolder ?? '';
    state.reportsFolderPath = saved?.reportsFolderPath ?? defaults.reportsFolder ?? '';
    state.allureFolderPath = saved?.allureFolderPath || '';
    state.allureEnabled = saved ? saved.allureEnabled !== false : true;
    state.allureOpenInBrowser = Boolean(saved?.allureOpenInBrowser);
    state.appendMode = Boolean(saved?.appendMode);
    state.reportsAppendMode = Boolean(saved?.reportsAppendMode);
    state.planParallel = Boolean(saved?.planParallel);
    state.collapsedSections = new Set(Array.isArray(saved?.collapsedSections) ? saved.collapsedSections : ['allure']);
    state.accordionSizes = { plans: 1, reports: 1, allure: 1, ...(saved?.accordionSizes || {}) };
    state.filterText = saved?.filterText || '';
    state.selectedTags = new Set(Array.isArray(saved?.selectedTags) ? saved.selectedTags : []);
    state.collapsedNodes = new Set(Array.isArray(ui.collapsedNodes) ? ui.collapsedNodes : []);
    state.consoleOpen = Boolean(ui.consoleOpen);
    state.showSidebar = ui.showSidebar !== false;
    state.showRepo = ui.showRepo !== false;
    state.plan = getPlanItemsFromFile({ type: PLAN_FILE_TYPE, items: Array.isArray(saved?.plan) ? saved.plan : [] }) || [];

    elements['input-filter'].value = state.filterText;
    setUiSizes(ui);
    setStatus('idle');
    showApp();

    writeLog(saved ? 'Previous session restored.' : 'G4 Test Wright ready. Bots, plans, and reports folders follow the G4 project layout.', 'muted');

    if (!defaults.hasManifest) {
        writeLog('No manifest.json found in this workspace; the engine defaults to http://localhost:9944.', 'warn');
    }

    await Promise.all([updateEnvironments(), updateSchedules(), updateEngineStatus()]);

    if (state.folderPath) {
        await startDiscovery({ isKeepingFilters: true });
    }

    if (state.repoFolderPath) {
        await updateRepo();
    }

    if (state.reportsFolderPath) {
        await updateReports();
    }

    updateIdleStatus();
    showApp();
}

/**
 * Saves the session now.
 *
 * @returns {void}
 */
function saveSession() {
    clearTimeout(runtime.saveTimer);
    runtime.saveTimer = null;
    void g4Host.request('state:save', newStateSnapshot());
}

/**
 * Applies persisted panel sizes.
 *
 * @param {object} ui - The persisted ui block.
 * @returns {void}
 */
function setUiSizes(ui) {
    if (ui.sidebarW) {
        runtime.uiSidebarW = ui.sidebarW;
    }

    if (ui.repoW) {
        runtime.uiRepoW = ui.repoW;
    }

    updateBodyGrid();

    if (ui.splitTreeW) {
        runtime.uiSplitTreeW = ui.splitTreeW;
        updateSplitGrid();
    }

    if (ui.consoleHeight) {
        runtime.consoleHeightPx = ui.consoleHeight;
        elements['console-drawer'].style.height = `${runtime.consoleHeightPx}px`;
    }
}
