'use strict';

/*
 * Test Wright page orchestrator: shared state, element lookup, status, event wiring, the run
 * manager, and boot. Loaded after the components and the feature modules (test-wright-*.js), which
 * share the page's global scope like the desktop Test Wright renderer modules.
 */

/* Single source of truth */
const state = {
    folderPath: '',                  // bots folder (each file a test, each subfolder a suite)
    environment: '',                 // selected environment name ('' = none)
    environments: [],                // [{ name, path, parameterCount }]
    tests: [],                       // [{ id, name, file, path, suite, tags }]
    plan: [],                        // ordered [{ uid, testId, status, checked, name, file, suite, tags, folder }]
    selectedTags: new Set(),         // active tag filters
    filterText: '',
    status: 'idle',                  // idle|discovering|ready|running|scheduled|failed
    scheduledRuns: [],               // host schedules [{ id, runAt, label, items, testParallel, environment }]
    parallelMode: false,             // SCHEDULE: due runs start in parallel (true) or queue (false)
    planParallel: false,             // PLAN: bots within a run execute in parallel (true) or sequentially
    collapsedNodes: new Set(),       // suites that are collapsed
    consoleOpen: false,
    consoleUnread: false,
    showSidebar: true,
    showRepo: true,
    repoFolderPath: '',              // plans repository folder
    repoPlans: [],
    appendMode: false,               // plan drop appends (true) or replaces (false)
    reportsFolderPath: '',           // reports folder (one folder per run)
    reportsList: [],
    reportsAppendMode: false,
    reportDateFilter: '',            // session-only, never persisted
    allureFolderPath: '',            // Allure source folder ('' = the reports folder)
    allureEnabled: true,             // runs write Allure results (allure-<run>)
    allureOpenInBrowser: false,      // Open target: browser (true) or VS Code tab (false)
    collapsedSections: new Set(['allure']),
    accordionSizes: { plans: 1, reports: 1, allure: 1 }
};

/* Element lookup */
const elements = {};

/* Mutable runtime values that are not persisted */
const runtime = {
    // Monotonic id for plan rows and runs. Each page starts at a random point above the scheduler's
    // ids (1,000,000+) so run ids stay unique when several Test Wright tabs are open.
    nextUid: 1_000_000_000 + Math.floor(Math.random() * 1_000_000_000),
    dragPayload: null,               // { kind, ids?, uid?, path?, items? }
    lastStatuses: new Map(),         // bot id -> status of its latest run from this page
    treeRows: new Map(),             // row key -> { kind, ids, parentKey, ... } of the rendered tree
    treeSelection: '',               // selected tree row key ('suite:<path>' or 'bot:<id>')
    activeRuns: 0,                   // runs started from this page
    hostActiveRuns: 0,               // every run in the host (includes scheduled runs)
    activeRunIds: new Set(),         // run ids this page can stop
    runFailed: false,
    runQueue: [],
    isAllureBusy: false,             // an Allure report is being generated from the Open button
    maximumSchedules: 5,
    environmentsFolder: '',
    defaults: {},                    // folders and engine from the host
    uiSidebarW: 290,
    uiRepoW: 320,
    uiSplitTreeW: 0,
    consoleHeightPx: 220,
    ready: false,                    // autosave starts after the restore
    saveTimer: null
};

const STATUS_LABEL = {
    idle: 'Idle',
    discovering: 'Discovering',
    ready: 'Ready',
    running: 'Running',
    scheduled: 'Scheduled',
    failed: 'Failed'
};

/**
 * Finds a discovered bot by id.
 *
 * @param {string} id - The bot id.
 * @returns {object|undefined} The bot.
 */
function findTest(id) {
    return state.tests.find((test) => test.id === id);
}

/**
 * Caches every element looked up by id.
 *
 * @returns {void}
 */
function getElements() {
    const ids = [
        'header-folder-path', 'status-pill', 'status-text', 'engine-chip', 'engine-text', 'sidebar',
        'btn-select-folder', 'environment-picker', 'resizer-left', 'btn-discover', 'input-filter',
        'tag-filter', 'input-schedule', 'btn-schedule', 'schedule-list', 'toggle-parallel-runs',
        'count-total', 'count-visible', 'count-plan', 'count-checked', 'btn-run', 'btn-stop',
        'btn-clear-plan', 'btn-import-plan', 'btn-export-plan', 'btn-save-plan-repo',
        'toggle-parallel-tests', 'btn-clear-tree', 'btn-expand-tree', 'btn-collapse-tree', 'tree-list',
        'plan-list', 'pane-resizer', 'resizer-right', 'repo', 'repo-accordion',
        'btn-select-plans-folder', 'repo-folder', 'btn-refresh-plans', 'toggle-plans-append', 'repo-list',
        'btn-select-reports-folder', 'reports-folder', 'btn-refresh-reports', 'toggle-reports-append',
        'report-date-filter', 'reports-list', 'btn-select-allure-folder', 'allure-folder',
        'toggle-allure-collect', 'toggle-allure-browser', 'btn-open-allure', 'console-drawer',
        'console-log', 'drawer-resizer', 'console-toggle', 'console-unread', 'statusbar-info',
        'toggle-sidebar', 'toggle-repo', 'edge-sidebar', 'edge-repo', 'edge-console'
    ];

    ids.forEach((id) => {
        elements[id] = document.getElementById(id);
    });
}

/**
 * Boots the page: elements, events, resizers, host defaults, then the session restore.
 *
 * @returns {Promise<void>}
 */
async function initializeApp() {
    getElements();
    registerEvents();
    registerHostEvents();
    registerResizers();

    try {
        runtime.defaults = await g4Host.request('app:getDefaults');
        runtime.hostActiveRuns = runtime.defaults.activeRuns || 0;
    } catch (error) {
        writeLog(`Host defaults unavailable: ${error.message}`, 'warn');
    }

    await restoreSession();
    updateBodyGrid();
    runtime.ready = true;
    window.addEventListener('beforeunload', saveSession);
}

/**
 * Wires the page controls.
 *
 * @returns {void}
 */
function registerEvents() {
    elements['btn-select-folder'].addEventListener('click', selectFolder);
    elements['btn-discover'].addEventListener('click', () => startDiscovery());
    elements['btn-run'].addEventListener('click', startCheckedPlan);
    elements['btn-stop'].addEventListener('click', stopRuns);
    elements['btn-import-plan'].addEventListener('click', readPlan);
    elements['btn-export-plan'].addEventListener('click', savePlan);
    elements['btn-save-plan-repo'].addEventListener('click', savePlanToRepo);
    elements['btn-clear-plan'].addEventListener('click', clearPlan);
    elements['btn-clear-tree'].addEventListener('click', clearTree);
    elements['btn-expand-tree'].addEventListener('click', () => setAllNodesCollapsed(false));
    elements['btn-collapse-tree'].addEventListener('click', () => setAllNodesCollapsed(true));
    elements['tree-list'].addEventListener('keydown', resolveTreeKey);
    elements['tree-list'].addEventListener('click', selectTreeRowFromEvent);
    elements['btn-schedule'].addEventListener('click', addScheduledRun);
    elements['btn-select-plans-folder'].addEventListener('click', selectPlansFolder);
    elements['btn-refresh-plans'].addEventListener('click', updateRepo);
    elements['btn-select-reports-folder'].addEventListener('click', selectReportsFolder);
    elements['btn-refresh-reports'].addEventListener('click', updateReports);
    elements['btn-select-allure-folder'].addEventListener('click', selectAllureFolder);
    elements['btn-open-allure'].addEventListener('click', openAllure);
    elements['engine-chip'].addEventListener('click', updateEngineStatus);
    elements['console-toggle'].addEventListener('click', switchConsole);
    elements['toggle-sidebar'].addEventListener('click', switchSidebar);
    elements['toggle-repo'].addEventListener('click', switchRepo);

    // Components report through bubbling g4-* events.
    elements['environment-picker'].addEventListener('g4-change', selectEnvironment);
    elements['environment-picker'].addEventListener('g4-action', resolveEnvironmentAction);
    elements['tag-filter'].addEventListener('g4-action', resolveTagAction);
    elements['repo-accordion'].addEventListener('g4-change', setAccordionState);
    elements['input-schedule'].addEventListener('g4-input', showButtons);
    elements['report-date-filter'].addEventListener('g4-input', setReportDateFilter);
    elements['toggle-parallel-runs'].addEventListener('g4-input', setScheduleParallel);
    elements['toggle-parallel-tests'].addEventListener('g4-input', (event) => setFlag('planParallel', event));
    elements['toggle-plans-append'].addEventListener('g4-input', (event) => setFlag('appendMode', event));
    elements['toggle-reports-append'].addEventListener('g4-input', (event) => setFlag('reportsAppendMode', event));
    elements['toggle-allure-collect'].addEventListener('g4-input', (event) => setFlag('allureEnabled', event));
    elements['toggle-allure-browser'].addEventListener('g4-input', (event) => setFlag('allureOpenInBrowser', event));

    // The plan is the drop target of the tree and the repositories.
    elements['plan-list'].addEventListener('dragover', showPlanDropMarker);
    elements['plan-list'].addEventListener('drop', addDroppedTests);
    elements['plan-list'].addEventListener('dragleave', (event) => {
        if (!elements['plan-list'].contains(event.relatedTarget)) {
            clearPlanDropMarkers();
        }
    });

    elements['input-filter'].addEventListener('input', (event) => {
        state.filterText = event.target.value;
        showApp();
    });
}

/**
 * Subscribes to host events: run logs, active run count, schedules, and finished scheduled runs.
 *
 * @returns {void}
 */
function registerHostEvents() {
    g4Host.on('run:event', (event) => {
        if (event.type === 'log' && event.text) {
            writeLog(event.text, event.kind || '');
        }
    });

    g4Host.on('run:active', (count) => {
        runtime.hostActiveRuns = count;

        if (runtime.activeRuns === 0) {
            updateIdleStatus();
            showApp();
        }
    });

    g4Host.on('schedules:changed', setSchedules);
    g4Host.on('reports:changed', () => updateReports());
}

/**
 * Stores a boolean toggle in the state.
 *
 * @param {string} key - State key.
 * @param {CustomEvent} event - g4-input { value }.
 * @returns {void}
 */
function setFlag(key, event) {
    state[key] = event.detail.value === true;
    showApp();
}

/**
 * Sets the status and reflects it on the status pill.
 *
 * @param {string} status - idle|discovering|ready|running|scheduled|failed.
 * @returns {void}
 */
function setStatus(status) {
    state.status = status;
    elements['status-pill'].className = `status-pill status-${status}`;
    elements['status-text'].textContent = STATUS_LABEL[status] || status;
}

/**
 * Re-renders the whole page from the state and requests a save.
 *
 * @returns {void}
 */
function showApp() {
    showFolder();
    showEnvironment();
    showTags();
    showTree();
    showPlan();
    showRepo();
    showReports();
    showAllure();
    showAccordion();
    showCounts();
    showSchedules();
    showButtons();
    showStatusbar();
    showConsoleState();
    showLayoutToggles();
    requestSave();
}

/**
 * Shows the bots folder in the header.
 *
 * @returns {void}
 */
function showFolder() {
    elements['header-folder-path'].textContent = state.folderPath || 'No folder selected';
    elements['btn-select-folder'].title = state.folderPath ? `Bots folder: ${state.folderPath}` : 'Select the bots folder';
}

/**
 * Shows the status and bot count in the status bar.
 *
 * @returns {void}
 */
function showStatusbar() {
    const label = STATUS_LABEL[state.status] || state.status;
    const environment = state.environment ? ` • ${state.environment}` : '';

    elements['statusbar-info'].textContent = `${label} • ${state.tests.length} bots • ${state.plan.length} in plan${environment}`;
}

/**
 * Runs the checked plan rows now.
 *
 * @returns {void}
 */
function startCheckedPlan() {
    const items = getCheckedPlanItems().map((item) => ({ uid: item.uid, testId: item.testId }));

    void startRun(items, { parallel: state.planParallel });
}

/**
 * Runs items, tracking concurrency and the final status.
 *
 * @param {Array<object>} items - The run items [{ uid, testId }].
 * @param {object} [options] - { parallel }.
 * @returns {Promise<void>}
 */
async function startRun(items, options = {}) {
    if (items.length === 0) {
        return;
    }

    if (runtime.activeRuns === 0) {
        runtime.runFailed = false;
    }

    runtime.activeRuns += 1;
    setStatus('running');
    showApp();

    const isFailed = await invokePlanRun(items, options);

    runtime.runFailed = runtime.runFailed || isFailed;
    runtime.activeRuns -= 1;

    if (runtime.activeRuns === 0) {
        if (runtime.runFailed) {
            setStatus('failed');
        } else {
            updateIdleStatus();
        }
    }

    showApp();
}

/**
 * Stops every run started from this page.
 *
 * @returns {void}
 */
function stopRuns() {
    if (runtime.activeRunIds.size === 0) {
        return;
    }

    writeLog('Stopping run(s)... (requests in flight are abandoned; the engine may finish its session)', 'warn');
    runtime.activeRunIds.forEach((runId) => testClient.stopRun(runId));
}

/**
 * Computes the idle status (running > scheduled > ready > idle) and applies it.
 *
 * @returns {string} The status.
 */
function updateIdleStatus() {
    let status = state.tests.length ? 'ready' : 'idle';

    if (runtime.activeRuns > 0 || runtime.hostActiveRuns > 0) {
        status = 'running';
    } else if (state.scheduledRuns.length > 0) {
        status = 'scheduled';
    } else if (state.status === 'failed') {
        status = 'failed';
    }

    setStatus(status);

    return status;
}

document.addEventListener('DOMContentLoaded', () => void initializeApp());
