/*
 * G4(TM) run summary component: <g4-run-summary>.
 *
 * Shows one Test Wright run record (run.json): the run name and status, when and where it ran, the
 * per-status tally, report tools, and one row per bot with its status, duration, and message.
 * Clicking a bot that has a saved G4 report asks the page to open it.
 *
 * Contract:
 * - Attributes: test-id (prefix of every part's data-test-id).
 * - Properties: record (the run record object).
 * - Methods: showNotice(text, level) shows a one-line notice ('info' | 'error'); '' hides it.
 * - Events (bubble): g4-action { id: 'open-bot', testId } | { id: 'open-allure' |
 *   'open-allure-browser' | 'convert-allure' | 'open-json' | 'reveal-folder' }.
 */
(() => {
    'use strict';

    // Component name: the custom element tag, the template id prefix, and the default test id prefix.
    const COMPONENT_NAME = 'g4-run-summary';

    // Display text per status.
    const STATUS_LABELS = {
        'not-run': 'Not Run',
        queued: 'Queued',
        running: 'Running',
        passed: 'Passed',
        failed: 'Failed',
        warning: 'Warning',
        broken: 'Broken',
        canceled: 'Canceled'
    };

    // Tally entries in display order.
    const TALLY_KEYS = ['passed', 'failed', 'warning', 'broken', 'canceled'];

    /**
     * Formats milliseconds as seconds with two decimals.
     *
     * @param {number} milliseconds - Duration.
     * @returns {string} For example "1.25s".
     */
    const formatDuration = (milliseconds) => `${((Number(milliseconds) || 0) / 1000).toFixed(2)}s`;

    /**
     * Run summary element.
     */
    class G4RunSummary extends HTMLElement {
        // Whether the template has been rendered into this element.
        #isRendered = false;

        // The run record shown.
        #record = null;

        /**
         * The run record shown.
         *
         * @returns {object | null} The record.
         */
        get record() {
            return this.#record;
        }

        /**
         * Shows a run record.
         *
         * @param {object} record - The run record (run.json).
         */
        set record(record) {
            this.#record = record ?? null;
            this.#showRecord();
        }

        /**
         * Renders the summary once.
         */
        connectedCallback() {
            // An element moved in the page keeps its rendered parts and listeners.
            if (this.#isRendered) {
                return;
            }

            this.#isRendered = true;

            const content = this.#newContent();

            content.querySelectorAll('[data-action]').forEach((button) => {
                button.addEventListener('click', () => this.#dispatchAction({ id: button.dataset.action }));
            });

            this.replaceChildren(content);
            this.#showRecord();
        }

        /**
         * Shows or hides the one-line notice.
         *
         * @param {string} text - Notice text; '' hides the notice.
         * @param {string} [level] - 'info' or 'error'.
         */
        showNotice(text, level = 'info') {
            const notice = this.#getPart('notice');

            if (!notice) {
                return;
            }

            notice.hidden = !text;
            notice.textContent = text ?? '';
            notice.classList.toggle('g4-run-summary__notice--error', level === 'error');
        }

        /**
         * Reports a user action.
         *
         * @param {object} detail - Action detail.
         */
        #dispatchAction(detail) {
            this.dispatchEvent(new CustomEvent('g4-action', { bubbles: true, detail }));
        }

        /**
         * Returns a rendered part.
         *
         * @param {string} name - data-part name.
         * @returns {HTMLElement | null} The part.
         */
        #getPart(name) {
            return this.querySelector(`[data-part="${name}"]`);
        }

        /**
         * Builds a status badge.
         *
         * @param {string} status - Status key.
         * @returns {HTMLSpanElement} The badge.
         */
        #newBadge(status) {
            const badge = document.createElement('span');

            badge.className = `g4-run-summary__badge g4-run-summary__badge--${status}`;
            badge.textContent = STATUS_LABELS[status] ?? status;

            return badge;
        }

        /**
         * Builds one bot row.
         *
         * @param {object} test - A test record.
         * @param {string} prefix - Test id prefix.
         * @returns {HTMLElement} The row.
         */
        #newCase(test, prefix) {
            const row = document.createElement('div');
            const top = document.createElement('div');
            const name = document.createElement('span');
            const time = document.createElement('span');
            const hasReport = Boolean(test.reportFile);

            row.className = 'g4-run-summary__case';
            row.dataset.testId = `${prefix}-case-${test.id}`;
            row.classList.toggle('g4-run-summary__case--openable', hasReport);
            row.title = hasReport ? 'Open the G4 report of this bot' : 'No G4 report: the bot got no engine response';
            top.className = 'g4-run-summary__case-top';
            name.className = 'g4-run-summary__case-name';
            name.textContent = test.name;
            time.className = 'g4-run-summary__case-time';
            time.textContent = formatDuration(test.duration);
            top.append(name, time, this.#newBadge(test.status));
            row.append(top);

            const details = [test.suite ? `suite: ${test.suite}` : 'suite: (root)'];

            if (test.assertions?.total) {
                details.push(`assertions: ${test.assertions.total - test.assertions.failed}/${test.assertions.total} passed`);
            }

            if (test.exceptions) {
                details.push(`exceptions: ${test.exceptions}`);
            }

            if (test.tags?.length) {
                details.push(`tags: ${test.tags.join(', ')}`);
            }

            const detailLine = document.createElement('span');

            detailLine.className = 'g4-run-summary__case-detail';
            detailLine.textContent = details.join('  |  ');
            row.append(detailLine);

            if (test.message) {
                const message = document.createElement('pre');

                message.className = 'g4-run-summary__case-message';
                message.textContent = test.message;
                row.append(message);
            }

            if (hasReport) {
                row.tabIndex = 0;
                row.setAttribute('role', 'button');
                row.addEventListener('click', () => this.#dispatchAction({ id: 'open-bot', testId: test.id }));
                row.addEventListener('keydown', (event) => {
                    if (event.key === 'Enter' || event.key === ' ') {
                        event.preventDefault();
                        this.#dispatchAction({ id: 'open-bot', testId: test.id });
                    }
                });
            }

            return row;
        }

        /**
         * Clones the template and prefixes every part's test id with this element's test-id.
         *
         * @returns {DocumentFragment} The markup.
         */
        #newContent() {
            const template = document.getElementById(`${COMPONENT_NAME}-template`);
            const content = template.content.cloneNode(true);
            const prefix = this.getAttribute('test-id') || COMPONENT_NAME;

            content.querySelectorAll('[data-test-id]').forEach((element) => {
                element.dataset.testId = `${prefix}-${element.dataset.testId}`;
            });

            return content;
        }

        /**
         * Renders the record into the parts.
         */
        #showRecord() {
            const title = this.#getPart('title');

            if (!title) {
                return;
            }

            const record = this.#record;
            const cases = this.#getPart('cases');
            const prefix = this.getAttribute('test-id') || COMPONENT_NAME;

            if (!record) {
                title.textContent = 'No run selected';
                cases.replaceChildren();

                return;
            }

            const status = this.#getPart('status');
            const started = new Date(record.startedAt);
            const meta = [
                Number.isNaN(started.getTime()) ? '' : started.toLocaleString(),
                formatDuration(record.duration),
                `environment: ${record.environment || '(none)'}`,
                `engine: ${record.engine}`,
                record.parallel ? 'parallel' : 'sequential',
                record.scheduled ? 'scheduled' : ''
            ].filter((part) => part !== '');

            title.textContent = record.label ? `${record.label} (${record.name})` : record.name;
            status.className = `g4-run-summary__badge g4-run-summary__badge--${record.status}`;
            status.textContent = STATUS_LABELS[record.status] ?? record.status;
            this.#getPart('meta').textContent = meta.join('  |  ');

            const tally = this.#getPart('tally');
            const total = document.createElement('span');

            const totalCount = record.tally?.total ?? record.tests.length;

            total.innerHTML = `<strong></strong> ${totalCount === 1 ? 'bot' : 'bots'}`;
            total.firstChild.textContent = String(totalCount);
            tally.replaceChildren(total, ...TALLY_KEYS.map((key) => {
                const entry = document.createElement('span');
                const count = document.createElement('strong');

                entry.className = `g4-run-summary__tally-entry g4-run-summary__tally-entry--${key}`;
                count.textContent = String(record.tally?.[key] ?? 0);
                entry.append(count, ` ${STATUS_LABELS[key].toLowerCase()}`);

                return entry;
            }));

            if (record.tests.length === 0) {
                const empty = document.createElement('div');

                empty.className = 'g4-run-summary__empty';
                empty.textContent = 'This run has no bots.';
                cases.replaceChildren(empty);

                return;
            }

            cases.replaceChildren(...record.tests.map((test) => this.#newCase(test, prefix)));
        }
    }

    if (!customElements.get(COMPONENT_NAME)) {
        customElements.define(COMPONENT_NAME, G4RunSummary);
    }
})();
