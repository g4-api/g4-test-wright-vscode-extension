'use strict';

/*
 * Run actions: bots folder selection, discovery, and the run of plan items with live statuses.
 */

/**
 * Runs plan items through the host, updating rows from the streamed events.
 *
 * Behavior:
 * - Duplicate rows of the same bot share one execution and one verdict.
 * - Rows go queued -> running -> result; on Stop, unfinished rows go back to not-run.
 * - A manual run points the Reports repository at the run's folder and refreshes it.
 *
 * @param {Array<object>} items - The run items [{ uid, testId }].
 * @param {object} [options] - { parallel }.
 * @returns {Promise<boolean>} True when any bot failed or broke.
 */
async function invokePlanRun(items, { parallel = false } = {}) {
    const runId = runtime.nextUid++;
    const uidsByTestId = new Map();
    const bots = [];

    items.forEach((item) => {
        if (!uidsByTestId.has(item.testId)) {
            const row = state.plan.find((candidate) => candidate.uid === item.uid) || {};
            const folder = row.folder || state.folderPath;

            uidsByTestId.set(item.testId, []);
            bots.push({
                id: item.testId,
                name: row.name || item.testId,
                suite: row.suite || '',
                tags: row.tags || [],
                path: joinPath(folder, item.testId)
            });
        }

        uidsByTestId.get(item.testId).push(item.uid);
    });

    const applyToRows = (testId, status, message = '') => {
        // The bots tree shows each bot's latest status.
        runtime.lastStatuses.set(testId, status);

        (uidsByTestId.get(testId) || []).forEach((uid) => {
            setPlanStatus(uid, status);

            const row = state.plan.find((candidate) => candidate.uid === uid);

            if (row) {
                row.message = message;
            }
        });
    };

    // The tree follows too, so a bot that never starts (Stop) does not keep its previous status.
    items.forEach((item) => {
        setPlanStatus(item.uid, 'queued');
        runtime.lastStatuses.set(item.testId, 'queued');
    });
    runtime.activeRunIds.add(runId);
    showApp();

    let summary;

    try {
        summary = await testClient.invokeTests(
            {
                runId,
                tests: bots,
                folderPath: state.folderPath,
                environment: state.environment,
                parallel,
                collectAllure: state.allureEnabled
            },
            {
                onStart: (testId) => {
                    applyToRows(testId, 'running');

                    const firstUid = (uidsByTestId.get(testId) || [])[0];

                    if (firstUid !== undefined) {
                        showPlanRowInView(firstUid);
                    }

                    showApp();
                },
                onTest: (event) => {
                    applyToRows(event.id, event.outcome, event.text || '');
                    showApp();
                }
            }
        );
    } catch (error) {
        writeLog(`Run failed: ${error.message}`, 'fail');
        summary = { failed: true, canceled: false, runFile: '' };
    }

    runtime.activeRunIds.delete(runId);

    // Rows still waiting when the run ended (Stop, or a host error) go back to not-run.
    items.forEach((item) => {
        const row = state.plan.find((candidate) => candidate.uid === item.uid);

        if (row && (row.status === 'queued' || row.status === 'running')) {
            setPlanStatus(item.uid, summary.canceled ? 'canceled' : 'not-run');
        }

        if (['queued', 'running'].includes(runtime.lastStatuses.get(item.testId))) {
            runtime.lastStatuses.set(item.testId, summary.canceled ? 'canceled' : 'not-run');
        }
    });

    showApp();

    // Point the Reports repository at the folder the run was written to, then refresh it.
    if (summary.runFile) {
        const reportsFolder = getDirectoryName(getDirectoryName(summary.runFile));

        if (!state.reportsFolderPath) {
            state.reportsFolderPath = reportsFolder;
        }

        await updateReports();
        openReportsSection();
    }

    void updateEngineStatus();

    return summary.failed;
}

/**
 * Prompts for the bots folder, then discovers it.
 *
 * @returns {Promise<void>}
 */
async function selectFolder() {
    const folder = await g4Host.request('app:selectFolder', {
        title: 'Select the bots folder',
        defaultPath: state.folderPath || runtime.defaults.botsFolder || runtime.defaults.projectFolder
    });

    if (!folder) {
        return;
    }

    state.folderPath = folder;
    state.tests = [];
    writeLog(`Bots folder selected: ${folder}`, 'info');
    showApp();
    await startDiscovery();
}

/**
 * Discovers the bots of the selected folder. The plan is left untouched.
 *
 * @param {object} [options] - { isKeepingFilters }: keep the restored filters (session restore).
 * @returns {Promise<void>}
 */
async function startDiscovery({ isKeepingFilters = false } = {}) {
    if (!state.folderPath) {
        return;
    }

    setStatus('discovering');
    showButtons();
    writeLog(`Discovering bots in ${state.folderPath}...`, 'info');

    let result;

    try {
        result = await testClient.findTests({ folder: state.folderPath });
    } catch (error) {
        result = { tests: [], warnings: [], error: error.message };
    }

    if (!isKeepingFilters) {
        state.selectedTags.clear();
        state.collapsedNodes.clear();
        state.filterText = '';
        elements['input-filter'].value = '';
    }

    if (result.error) {
        state.tests = [];
        writeLog(`Discovery failed: ${result.error}`, 'fail');
        setStatus('failed');
        showApp();

        return;
    }

    state.tests = result.tests || [];

    (result.warnings || []).forEach((warning) => writeLog(`  ${warning}`, 'warn'));
    writeLog(`${state.tests.length} bot(s) discovered in ${new Set(state.tests.map((test) => test.suite)).size} suite(s).`, 'info');
    setStatus(runtime.activeRuns > 0 ? 'running' : 'ready');
    updateIdleStatus();
    showApp();
}

/**
 * Pings the engine and shows the result on the engine chip.
 *
 * @returns {Promise<void>}
 */
async function updateEngineStatus() {
    const chip = elements['engine-chip'];

    try {
        const result = await g4Host.request('app:pingEngine');

        chip.classList.toggle('online', result.isAlive);
        chip.classList.toggle('offline', !result.isAlive);
        elements['engine-text'].textContent = result.engine;
        chip.title = result.isAlive
            ? `G4 engine at ${result.engine} is online. Click to check again.`
            : `G4 engine at ${result.engine} does not answer. Start the engine (or fix g4Server in manifest.json), then click to check again.`;
    } catch {
        chip.classList.remove('online');
        chip.classList.add('offline');
    }
}
