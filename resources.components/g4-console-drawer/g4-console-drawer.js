/*
 * G4(TM) console drawer component: <g4-console-drawer>.
 *
 * A timestamped output log with Copy and Clear tools. Lines are colored by kind.
 *
 * Contract:
 * - Attributes: heading (title text, default 'Console'), max-lines (oldest lines are dropped beyond
 *   it, default 5000), test-id (prefix of every part's data-test-id).
 * - Properties: text (read-only, the whole log as plain text).
 * - Methods: log(text, kind) appends a line (kind: info | pass | fail | warn | muted | '');
 *   clear(); copy() copies the log to the clipboard; scrollToEnd().
 * - Events (bubble): g4-action { id: 'copied' | 'cleared' }.
 */
(() => {
    'use strict';

    // Component name: the custom element tag, the template id prefix, and the default test id prefix.
    const COMPONENT_NAME = 'g4-console-drawer';

    // Line kinds that get their own color.
    const LINE_KINDS = new Set(['info', 'pass', 'fail', 'warn', 'muted']);

    // Default cap on kept lines, so a long session never grows the page without bound.
    const DEFAULT_MAXIMUM_LINES = 5000;

    /**
     * Formats the current time as HH:MM:SS.
     *
     * @returns {string} The time text.
     */
    const getTimestamp = () => {
        const date = new Date();
        const pad = (value) => String(value).padStart(2, '0');

        return `${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}`;
    };

    /**
     * Console log element.
     */
    class G4ConsoleDrawer extends HTMLElement {
        // Whether the template has been rendered into this element.
        #isRendered = false;

        // Lines logged before the element rendered, replayed on render.
        #pendingLines = [];

        /**
         * The whole log as plain text.
         *
         * @returns {string} One line per entry.
         */
        get text() {
            return this.#getBody()?.innerText ?? '';
        }

        /**
         * Empties the log.
         */
        clear() {
            this.#getBody()?.replaceChildren();
            this.dispatchEvent(new CustomEvent('g4-action', { bubbles: true, detail: { id: 'cleared' } }));
        }

        /**
         * Renders the drawer once.
         */
        connectedCallback() {
            // An element moved in the page keeps its rendered parts and listeners.
            if (this.#isRendered) {
                return;
            }

            this.#isRendered = true;

            const content = this.#newContent();

            content.querySelector('[data-part="title"]').textContent = this.getAttribute('heading') || 'Console';
            content.querySelector('[data-part="copy"]').addEventListener('click', () => void this.copy());
            content.querySelector('[data-part="clear"]').addEventListener('click', () => this.clear());
            this.replaceChildren(content);

            // Lines logged before the drawer existed are kept, in order.
            this.#pendingLines.forEach(([text, kind]) => this.log(text, kind));
            this.#pendingLines = [];
        }

        /**
         * Copies the log to the clipboard and notes the result in the log.
         *
         * @returns {Promise<void>}
         */
        async copy() {
            try {
                await navigator.clipboard.writeText(this.text);
                this.log('Console output copied to clipboard.', 'muted');
                this.dispatchEvent(new CustomEvent('g4-action', { bubbles: true, detail: { id: 'copied' } }));
            } catch {
                this.log('Copy failed: the clipboard is not available.', 'warn');
            }
        }

        /**
         * Appends one timestamped line.
         *
         * @param {string} text - Line text (plain text, never markup).
         * @param {string} [kind] - info | pass | fail | warn | muted.
         */
        log(text, kind = '') {
            const body = this.#getBody();

            if (!body) {
                this.#pendingLines.push([text, kind]);

                return;
            }

            const line = document.createElement('div');
            const time = document.createElement('span');

            line.className = 'g4-console-drawer__line';
            line.dataset.testId = `${this.getAttribute('test-id') || COMPONENT_NAME}-line`;

            if (LINE_KINDS.has(kind)) {
                line.classList.add(`g4-console-drawer__line--${kind}`);
            }

            time.className = 'g4-console-drawer__time';
            time.textContent = `[${getTimestamp()}]`;
            line.append(time, document.createTextNode(String(text)));

            // Only follow the output when the user is already at the bottom.
            const isAtEnd = body.scrollHeight - body.scrollTop - body.clientHeight < 24;

            body.append(line);

            const maximumLines = Number(this.getAttribute('max-lines')) || DEFAULT_MAXIMUM_LINES;

            while (body.childElementCount > maximumLines) {
                body.firstElementChild.remove();
            }

            if (isAtEnd) {
                this.scrollToEnd();
            }
        }

        /**
         * Scrolls to the newest line.
         */
        scrollToEnd() {
            const body = this.#getBody();

            if (body) {
                body.scrollTop = body.scrollHeight;
            }
        }

        /**
         * Returns the rendered log body.
         *
         * @returns {HTMLElement | null} The body.
         */
        #getBody() {
            return this.querySelector(':scope > [data-part="body"]');
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
    }

    if (!customElements.get(COMPONENT_NAME)) {
        customElements.define(COMPONENT_NAME, G4ConsoleDrawer);
    }
})();
