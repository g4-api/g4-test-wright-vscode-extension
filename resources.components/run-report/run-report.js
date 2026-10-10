'use strict';

/*
 * Run report page: shows one run record in <g4-run-summary> and forwards its actions to the host
 * as { kind: 'action', id, testId?, browser? }. Host notices ({ kind: 'notice', text, level })
 * appear in the summary's notice line.
 */
(function () {
    const vscodeApi = acquireVsCodeApi();

    /**
     * Reads the injected { record, runFile } data.
     *
     * @returns {object} The data, or an empty object.
     */
    const readData = () => {
        try {
            return JSON.parse(document.getElementById('g4-data').value || '{}');
        } catch {
            return {};
        }
    };

    document.addEventListener('DOMContentLoaded', () => {
        const summary = document.getElementById('run-summary');
        const data = readData();

        summary.record = data.record ?? null;

        summary.addEventListener('g4-action', (event) => {
            const { id, testId } = event.detail;

            // The browser variant is the same host action with the browser flag.
            if (id === 'open-allure-browser') {
                vscodeApi.postMessage({ kind: 'action', id: 'open-allure', browser: true });

                return;
            }

            vscodeApi.postMessage({ kind: 'action', id, testId });
        });

        window.addEventListener('message', (event) => {
            if (event.data?.kind === 'notice') {
                summary.showNotice(event.data.text, event.data.level);
            }
        });
    });
})();
