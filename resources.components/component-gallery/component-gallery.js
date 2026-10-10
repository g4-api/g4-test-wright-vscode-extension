'use strict';

/*
 * Component gallery: feeds sample data to every component and logs the events they raise.
 */
(function () {
    const vscodeApi = acquireVsCodeApi();

    // Sample run record for <g4-run-summary>.
    const SAMPLE_RECORD = {
        type: 'g4-test-wright-run',
        version: 1,
        name: '2026-10-08-213643907',
        label: 'Nightly smoke',
        scheduled: true,
        startedAt: new Date().toISOString(),
        finishedAt: new Date().toISOString(),
        duration: 12840,
        environment: 'staging',
        engine: 'http://localhost:9944',
        botsFolder: 'bots',
        parallel: true,
        status: 'failed',
        tally: { total: 4, passed: 1, failed: 1, warning: 1, broken: 1, canceled: 0 },
        tests: [
            { id: 'smoke/login.json', name: 'login', suite: 'smoke', tags: ['smoke'], status: 'passed', duration: 2100, reportFile: 'smoke.login.g4rpt', message: '', assertions: { total: 2, failed: 0 }, exceptions: 0 },
            { id: 'smoke/search.json', name: 'search', suite: 'smoke', tags: ['smoke', 'web'], status: 'failed', duration: 3300, reportFile: 'smoke.search.g4rpt', message: "Assert: expected 'G4' (Match) but was 'g3'.", assertions: { total: 3, failed: 1 }, exceptions: 0 },
            { id: 'calculator.json', name: 'calculator', suite: '', tags: [], status: 'warning', duration: 5200, reportFile: 'calculator.g4rpt', message: 'InvokeClick: Invoke-Condition = TimedOut', assertions: { total: 0, failed: 0 }, exceptions: 1 },
            { id: 'orders/create.json', name: 'create', suite: 'orders', tags: ['api'], status: 'broken', duration: 40, reportFile: '', message: 'Engine unreachable at http://localhost:9944: connect ECONNREFUSED', assertions: { total: 0, failed: 0 }, exceptions: 0 }
        ]
    };

    // Selected sample tags.
    const selectedTags = new Set();

    document.addEventListener('DOMContentLoaded', () => {
        const log = document.getElementById('sample-console');
        const tagFilter = document.getElementById('sample-tag-filter');
        const tagCounts = { smoke: 2, web: 1, api: 1, untagged: 1 };
        const showTags = () => {
            tagFilter.items = Object.entries(tagCounts).map(([name, count]) => ({ name, count, selected: selectedTags.has(name) }));
        };

        document.getElementById('sample-environment-picker').environments = [
            { name: 'local', parameterCount: 3 },
            { name: 'staging', parameterCount: 12 },
            { name: 'production', parameterCount: 1 },
            { name: 'visual-staging', parameterCount: 1, issue: 'Rename the file: the engine accepts only letters, digits, and _ in environment names.' }
        ];

        showTags();
        tagFilter.addEventListener('g4-action', (event) => {
            const detail = event.detail;

            if (detail.id === 'toggle') {
                selectedTags.has(detail.name) ? selectedTags.delete(detail.name) : selectedTags.add(detail.name);
            } else if (detail.id === 'select-all') {
                detail.names.forEach((name) => selectedTags.add(name));
            } else {
                selectedTags.clear();
            }

            showTags();
        });

        document.getElementById('sample-run-summary').record = SAMPLE_RECORD;

        document.getElementById('open-modal').addEventListener('click', (event) => {
            const modal = document.createElement('g4-modal');
            const text = document.createElement('p');

            modal.setAttribute('modal-title', 'Sample modal');
            modal.setAttribute('test-id', 'sample-modal');
            text.textContent = 'Escape or the round Close button closes the modal.';
            modal.append(text);
            modal.show(event.currentTarget);
        });

        // Every component event is logged so contracts can be checked by hand.
        ['g4-input', 'g4-change', 'g4-action', 'g4-close'].forEach((type) => {
            document.addEventListener(type, (event) => {
                const source = event.target.getAttribute?.('test-id') || event.target.tagName?.toLowerCase();

                log.log(`${type} from ${source}: ${JSON.stringify(event.detail ?? null)}`, 'info');
            });
        });

        log.log('Gallery ready.', 'pass');
        vscodeApi.postMessage({ kind: 'console', text: 'Component gallery loaded.' });
    });
})();
