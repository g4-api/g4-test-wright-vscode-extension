'use strict';

/*
 * Reports repository: lists run records (run.json), filters them by date, shows a run in the
 * viewer (<g4-run-summary> in a modal), and loads a run's bots back into the plan for a rerun.
 */

/**
 * Builds plan rows from a run record (fresh uids and keys, no data).
 *
 * @param {object} record - The run record.
 * @returns {Array<object>} The rows: one per plan item of the run, in its order.
 *
 * @remarks
 * A run with iterations records each item once per iteration; the item is added once. Records
 * written before items had keys add one row per record, as before.
 */
function getPlanItemsFromReport(record) {
    const seenKeys = new Set();
    const tests = record.tests.filter((test) => {
        if (!test.key) {
            return true;
        }

        const isSeen = seenKeys.has(test.key);

        seenKeys.add(test.key);

        return !isSeen;
    });

    return tests.map((test) => ({
        uid: runtime.nextUid++,
        key: newItemKey(),
        data: [],
        testId: test.id,
        status: 'not-run',
        checked: true,
        name: test.name || test.id,
        file: test.file || test.id,
        suite: test.suite || '',
        tags: Array.isArray(test.tags) ? test.tags : [],
        folder: record.botsFolder || state.folderPath
    }));
}

/**
 * Loads a run's bots into the plan (append or replace, like the plans repository).
 *
 * @param {string} filePath - The run.json path.
 * @returns {Promise<void>}
 */
async function loadReportIntoPlan(filePath) {
    const result = await g4Host.request('reports:read', { path: filePath });

    if (!result || result.error) {
        writeLog(`Report load failed: ${result?.error || 'unknown error'}`, 'fail');

        return;
    }

    const items = getPlanItemsFromReport(result.record);
    const source = result.record.label || result.record.name;

    if (items.length === 0) {
        writeLog('The run has no bots to rerun.', 'warn');

        return;
    }

    if (state.reportsAppendMode) {
        state.plan.push(...items);
        writeLog(`Run bots appended: ${source} (+${items.length} items).`, 'info');
        showApp();

        // Read the appended bots, so they get rows for this plan's iterations.
        void updateDataColumns();

        return;
    }

    if (state.plan.length > 0) {
        const isConfirmed = await confirmDialog({
            title: 'Replace plan',
            message: `Replace the current plan with the bots of run "${source}"?`,
            confirmLabel: 'Replace'
        });

        if (!isConfirmed) {
            return;
        }
    }

    // A run record holds no plan data, so the loaded plan starts without iterations.
    state.plan = items;
    state.iterations = [];
    writeLog(`Run bots loaded: ${source} (${items.length} items).`, 'info');
    showApp();
    void updateDataColumns();
}

/**
 * Opens a run in the report viewer modal.
 *
 * @param {string} filePath - The run.json path.
 * @returns {Promise<void>}
 */
async function openReport(filePath) {
    const result = await g4Host.request('reports:read', { path: filePath });

    if (!result || result.error) {
        writeLog(`Report open failed: ${result?.error || 'unknown error'}`, 'fail');

        return;
    }

    const modal = document.createElement('g4-modal');
    const viewer = document.createElement('div');
    const summary = document.createElement('g4-run-summary');
    const openTab = document.createElement('button');

    modal.setAttribute('modal-title', 'Run Report');
    modal.setAttribute('size', 'fit');
    modal.setAttribute('test-id', 'report-viewer');
    openTab.type = 'button';
    openTab.className = 'btn btn-ghost btn-sm';
    openTab.dataset.slot = 'tools';
    openTab.dataset.testId = 'report-viewer-open-tab-button';
    openTab.textContent = 'Open in Tab';
    openTab.addEventListener('click', () => {
        modal.close();
        g4Host.request('reports:openTab', { path: filePath });
    });
    viewer.className = 'report-viewer';
    summary.setAttribute('test-id', 'report-viewer-summary');
    viewer.append(summary);
    modal.append(openTab, viewer);
    modal.show(document.activeElement instanceof HTMLElement ? document.activeElement : null);

    summary.record = result.record;
    summary.addEventListener('g4-action', (event) => resolveReportAction(summary, filePath, event.detail));
}

/**
 * Handles an action of the report viewer.
 *
 * @param {HTMLElement} summary - The <g4-run-summary>.
 * @param {string} runFile - The run.json path.
 * @param {object} detail - The g4-action detail.
 * @returns {Promise<void>}
 */
async function resolveReportAction(summary, runFile, detail) {
    try {
        switch (detail.id) {
            case 'open-bot':
                await g4Host.request('reports:openBot', { runFile, testId: detail.testId });
                break;
            case 'open-json':
                await g4Host.request('app:openFile', { path: runFile });
                break;
            case 'reveal-folder':
                await g4Host.request('app:revealFile', { path: runFile });
                break;
            case 'convert-allure': {
                const result = await g4Host.request('allure:convert', { runFile });

                summary.showNotice(`Allure results written (${result.count} result(s)).`);
                await updateReports();
                break;
            }
            case 'open-allure':
            case 'open-allure-browser': {
                summary.showNotice('Generating the Allure report...');
                await openAllureFolder(getDirectoryName(runFile), detail.id === 'open-allure-browser', true);
                summary.showNotice('');
                break;
            }
            default:
                break;
        }
    } catch (error) {
        summary.showNotice(error.message, 'error');
    }
}

/**
 * Prompts for a reports folder and lists its runs.
 *
 * @returns {Promise<void>}
 */
async function selectReportsFolder() {
    const folder = await g4Host.request('app:selectFolder', {
        title: 'Select the reports folder',
        defaultPath: state.reportsFolderPath || runtime.defaults.reportsFolder || runtime.defaults.projectFolder
    });

    if (!folder) {
        return;
    }

    state.reportsFolderPath = folder;
    state.reportDateFilter = '';
    writeLog(`Reports folder selected: ${folder}`, 'info');
    await updateReports();
}

/**
 * Applies the reports date filter.
 *
 * @param {CustomEvent} event - g4-input { value } from the date picker.
 * @returns {void}
 */
function setReportDateFilter(event) {
    state.reportDateFilter = event.detail.value;
    showReports();
}

/**
 * Renders one run row (drag onto the plan to rerun; click to view).
 *
 * @param {object} report - A report summary.
 * @returns {HTMLElement} The row.
 */
function showReportItem(report) {
    const item = document.createElement('div');
    const main = document.createElement('div');
    const name = document.createElement('span');
    const relativePath = document.createElement('span');
    const date = document.createElement('span');
    const stats = document.createElement('span');
    const tally = report.tally || {};
    const failed = (tally.failed || 0) + (tally.broken || 0);

    item.className = 'repo-item';
    item.draggable = true;
    item.title = 'Click to view; drag onto the plan to rerun its bots';
    item.dataset.testId = `report-${report.fileName}`;
    main.className = 'repo-item-main';
    name.className = 'repo-item-name';
    name.textContent = report.label ? `${report.label} (${report.name})` : report.name;
    relativePath.className = 'repo-item-path';
    relativePath.textContent = report.relativePath;
    date.className = 'repo-item-date';
    date.textContent = report.modifiedAt ? formatDateTime(new Date(report.modifiedAt)) : '';
    main.append(name, relativePath, date);

    stats.className = 'report-stats';
    stats.innerHTML = `<span>${formatCount(tally.total || 0, 'bot')}</span>` +
        (tally.passed ? `<span class="pass">${tally.passed} passed</span>` : '') +
        (failed ? `<span class="fail">${failed} failed</span>` : '') +
        (tally.warning ? `<span class="warn">${tally.warning} warning</span>` : '') +
        (tally.canceled ? `<span class="canceled">${tally.canceled} canceled</span>` : '');
    item.append(main, stats);

    item.addEventListener('dragstart', (event) => {
        runtime.dragPayload = { kind: 'report', path: report.path };
        event.dataTransfer.effectAllowed = 'copy';
        event.dataTransfer.setData('text/plain', report.path);
        item.classList.add('dragging');
    });

    item.addEventListener('dragend', () => {
        item.classList.remove('dragging');
        runtime.dragPayload = null;
        clearPlanDropMarkers();
    });

    item.addEventListener('click', () => openReport(report.path));

    return item;
}

/**
 * Renders the reports repository (folder header and list).
 *
 * @returns {void}
 */
function showReports() {
    elements['reports-folder'].textContent = state.reportsFolderPath || 'No folder selected';
    elements['btn-select-reports-folder'].title = state.reportsFolderPath ? `Reports folder: ${state.reportsFolderPath}` : 'Select reports folder';
    elements['btn-refresh-reports'].disabled = !state.reportsFolderPath;
    elements['toggle-reports-append'].value = state.reportsAppendMode;

    if (elements['report-date-filter'].value !== state.reportDateFilter) {
        elements['report-date-filter'].value = state.reportDateFilter;
    }

    const list = elements['reports-list'];

    if (!state.reportsFolderPath) {
        list.innerHTML = writeEmptyState('folder', 'No reports folder', 'Select a folder to list Test Wright runs.');

        return;
    }

    if (state.reportsList.length === 0) {
        list.innerHTML = writeEmptyState('search', 'No runs found', 'Run a plan; every run is saved here with its G4 and Allure reports.');

        return;
    }

    const filterTime = parseDateTime(state.reportDateFilter);
    const visible = Number.isNaN(filterTime)
        ? state.reportsList
        : state.reportsList.filter((report) => report.modifiedAt >= filterTime);

    if (visible.length === 0) {
        list.innerHTML = writeEmptyState('filter', 'No runs in range', 'No runs at or after the selected date and time. Clear the filter to see them all.');

        return;
    }

    list.replaceChildren(...visible.map(showReportItem));
}

/**
 * Re-scans the reports folder.
 *
 * @returns {Promise<void>}
 */
async function updateReports() {
    if (!state.reportsFolderPath) {
        return;
    }

    try {
        const result = await g4Host.request('reports:list', { folderPath: state.reportsFolderPath });

        state.reportsList = result?.reports || [];
    } catch (error) {
        state.reportsList = [];
        writeLog(`Reports scan error: ${error.message}`, 'warn');
    }

    showApp();
}
