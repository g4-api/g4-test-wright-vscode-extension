'use strict';

/*
 * Run actions: bots folder selection, discovery, and the run of plan items with live statuses.
 */

/**
 * Runs plan items through the host, updating rows from the streamed events.
 *
 * Behavior:
 * - Every plan item runs on its own, in its plan position, even when several items point at the
 *   same bot; results come back by item key, so each row gets its own verdict.
 * - With iterations, the whole suite runs once per included iteration; a row shows the result of
 *   its latest iteration while the run goes on, and its worst result when the run ends.
 * - Rows go queued -> running -> result; on Stop, unfinished rows go back to not-run.
 * - A manual run points the Reports repository at the run's folder and refreshes it.
 *
 * @param {Array<object>} items - The run items [{ uid, testId }].
 * @param {object} [options] - { parallel }.
 * @returns {Promise<boolean>} True when any bot failed or broke.
 */
async function invokePlanRun(items, { parallel = false } = {}) {
    const runId = runtime.nextUid++;
    const runItemsByKey = new Map();
    const bots = [];

    // Summarizes one item's results over several iterations: the worst status, and a message such
    // as "1/2 iterations passed. Iteration 2: <reason>" naming the first iteration that did not pass.
    const getIterationsVerdict = (outcomes) => {
        // Rank statuses from best to worst, so the row shows the worst iteration.
        const ranks = ['not-run', 'passed', 'canceled', 'warning', 'broken', 'failed'];
        const getWorse = (current, outcome) => (ranks.indexOf(outcome.status) > ranks.indexOf(current.status) ? outcome : current);
        const worst = outcomes.reduce(getWorse);

        // Count the passes and name the first problem, so the message says where to look.
        const passedCount = outcomes.filter((outcome) => outcome.status === 'passed').length;
        const firstProblem = outcomes.find((outcome) => outcome.status !== 'passed');
        const problemReason = firstProblem?.message || getStatusLabel(firstProblem?.status ?? '');
        const problemText = firstProblem ? ` Iteration ${firstProblem.iteration}: ${problemReason}` : '';

        return { status: worst.status, message: `${passedCount}/${outcomes.length} iterations passed.${problemText}` };
    };

    // Describe every item for the host: its key, position, bot, and one data row per iteration.
    items.forEach((item) => {
        const row = state.plan.find((candidate) => candidate.uid === item.uid) || {};
        const folder = row.folder || state.folderPath;
        const key = row.key || newItemKey();

        runItemsByKey.set(key, { uid: item.uid, testId: item.testId, outcomes: [] });
        bots.push({
            key,
            id: item.testId,
            name: row.name || item.testId,
            suite: row.suite || '',
            tags: row.tags || [],
            position: state.plan.indexOf(row) + 1,
            data: getRunData(row),
            path: joinPath(folder, item.testId)
        });
    });

    const applyToRow = (key, status, message = '') => {
        const runItem = runItemsByKey.get(key);

        if (!runItem) {
            return;
        }

        // The bots tree shows each bot's latest status; the plan row shows this item's own status.
        runtime.lastStatuses.set(runItem.testId, status);
        setPlanStatus(runItem.uid, status);

        const row = state.plan.find((candidate) => candidate.uid === runItem.uid);

        if (row) {
            row.message = message;
        }
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
                iterations: state.iterations.map((iteration) => ({ include: iteration.include !== false })),
                folderPath: state.folderPath,
                environment: state.environment,
                parallel,
                collectAllure: state.allureEnabled
            },
            {
                onStart: (key) => {
                    applyToRow(key, 'running');

                    const runItem = runItemsByKey.get(key);

                    if (runItem) {
                        showPlanRowInView(runItem.uid);
                    }

                    showApp();
                },
                onTest: (event) => {
                    // Keep every iteration's result, so the row can show its worst one at the end.
                    const outcome = { iteration: event.iteration || 0, status: event.outcome, message: event.text || '' };

                    runItemsByKey.get(event.id)?.outcomes.push(outcome);
                    applyToRow(event.id, event.outcome, event.text || '');
                    showApp();
                }
            }
        );
    } catch (error) {
        writeLog(`Run failed: ${error.message}`, 'fail');
        summary = { failed: true, canceled: false, runFile: '' };
    }

    runtime.activeRunIds.delete(runId);

    // Show each item's verdict over all its iterations: the worst result, with a pass count.
    for (const [key, runItem] of runItemsByKey) {
        if (runItem.outcomes.length > 1) {
            const verdict = getIterationsVerdict(runItem.outcomes);

            applyToRow(key, verdict.status, verdict.message);
        }
    }

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

    // A failed run stays visible after a rediscovery.
    const wasFailed = state.status === 'failed';

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
    setStatus(wasFailed ? 'failed' : 'ready');
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
