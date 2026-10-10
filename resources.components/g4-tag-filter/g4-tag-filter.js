/*
 * G4(TM) tag filter component: <g4-tag-filter>.
 *
 * A trigger that summarizes the selected tags ("No tags yet", "All tags", "2 selected") and opens a
 * searchable multi-select list of tags with their bot counts. The page owns the selection: the
 * component reports clicks and re-renders from the items it is given. Replaces the desktop Test
 * Wright's pytest mark filter; tags come from each bot's reference.tags.
 *
 * Contract:
 * - Attributes: test-id (prefix of every part's data-test-id).
 * - Properties: items (array of { name, count, selected }).
 * - Methods: close().
 * - Events (bubble): g4-action { id: 'toggle', name } | { id: 'select-all', names } | { id: 'clear' }.
 */
(() => {
    'use strict';

    // Component name: the custom element tag, the template id prefix, and the default test id prefix.
    const COMPONENT_NAME = 'g4-tag-filter';

    /**
     * Tag filter element.
     */
    class G4TagFilter extends HTMLElement {
        // Whether the template has been rendered into this element.
        #isRendered = false;

        // Tags offered by the panel.
        #items = [];

        // Current search text.
        #searchText = '';

        // Closes the panel when the user clicks outside the filter.
        #onDocumentMouseDown = (event) => {
            if (!this.contains(event.target)) {
                this.close();
            }
        };

        /**
         * Tags offered by the panel.
         *
         * @returns {{ name: string, count: number, selected: boolean }[]} The items.
         */
        get items() {
            return [...this.#items];
        }

        /**
         * Sets the tags and re-renders the trigger and the open panel.
         *
         * @param {{ name: string, count: number, selected: boolean }[]} items - The items.
         */
        set items(items) {
            this.#items = Array.isArray(items) ? items : [];
            this.#showLabel();

            if (!this.#getPart('panel')?.hidden) {
                this.#showOptions();
            }
        }

        /**
         * Closes the panel.
         */
        close() {
            const panel = this.#getPart('panel');

            if (panel && !panel.hidden) {
                panel.hidden = true;
                this.#getPart('trigger').setAttribute('aria-expanded', 'false');
                document.removeEventListener('mousedown', this.#onDocumentMouseDown);
            }
        }

        /**
         * Renders the filter once.
         */
        connectedCallback() {
            // An element moved in the page keeps its rendered parts and listeners.
            if (this.#isRendered) {
                return;
            }

            this.#isRendered = true;

            const content = this.#newContent();

            content.querySelector('[data-part="trigger"]').addEventListener('click', () => this.#togglePanel());
            content.querySelector('[data-part="search"]').addEventListener('input', (event) => {
                this.#searchText = event.target.value;
                this.#showOptions();
            });
            content.querySelector('[data-part="select-all"]').addEventListener('click', () => {
                this.#dispatchAction({ id: 'select-all', names: this.#getVisibleItems().map((item) => item.name) });
            });
            content.querySelector('[data-part="clear"]').addEventListener('click', () => this.#dispatchAction({ id: 'clear' }));
            // Escape closes the open panel wherever the focus is inside the component (the trigger
            // keeps the focus after a click, so a listener on the panel alone would miss it).
            this.addEventListener('keydown', (event) => {
                if (event.key === 'Escape' && !this.#getPart('panel').hidden) {
                    this.close();
                    this.#getPart('trigger').focus();
                }
            });

            this.replaceChildren(content);
            this.#showLabel();
        }

        /**
         * Stops listening for outside clicks when removed.
         */
        disconnectedCallback() {
            document.removeEventListener('mousedown', this.#onDocumentMouseDown);
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
         * Items that match the search text.
         *
         * @returns {{ name: string, count: number, selected: boolean }[]} The items.
         */
        #getVisibleItems() {
            const query = this.#searchText.trim().toLowerCase();

            return this.#items.filter((item) => query === '' || item.name.toLowerCase().includes(query));
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
         * Summarizes the selection on the trigger and disables it when there are no tags.
         */
        #showLabel() {
            const label = this.#getPart('label');

            if (!label) {
                return;
            }

            const selectedCount = this.#items.filter((item) => item.selected).length;

            this.#getPart('trigger').disabled = this.#items.length === 0;

            if (this.#items.length === 0) {
                label.textContent = 'No tags yet';
            } else if (selectedCount === 0) {
                label.textContent = 'All tags';
            } else {
                label.textContent = `${selectedCount} selected`;
            }
        }

        /**
         * Renders the option rows that match the search.
         */
        #showOptions() {
            const options = this.#getPart('options');
            const visibleItems = this.#getVisibleItems();
            const prefix = this.getAttribute('test-id') || COMPONENT_NAME;

            options.replaceChildren();

            if (visibleItems.length === 0) {
                const empty = document.createElement('div');

                empty.className = 'g4-tag-filter__empty';
                empty.textContent = this.#items.length === 0 ? 'No tags discovered.' : 'No tags match.';
                options.append(empty);

                return;
            }

            visibleItems.forEach((item) => {
                const row = document.createElement('label');
                const checkbox = document.createElement('input');
                const name = document.createElement('span');
                const count = document.createElement('span');

                row.className = 'g4-tag-filter__option';
                row.classList.toggle('g4-tag-filter__option--checked', item.selected);
                row.dataset.testId = `${prefix}-option-${item.name}`;
                checkbox.type = 'checkbox';
                checkbox.checked = item.selected;
                checkbox.addEventListener('change', () => this.#dispatchAction({ id: 'toggle', name: item.name }));
                name.className = 'g4-tag-filter__option-name';
                name.textContent = item.name;
                count.className = 'g4-tag-filter__option-count';
                count.textContent = String(item.count);
                row.append(checkbox, name, count);
                options.append(row);
            });
        }

        /**
         * Opens or closes the panel.
         */
        #togglePanel() {
            const panel = this.#getPart('panel');

            if (!panel.hidden) {
                this.close();

                return;
            }

            const search = this.#getPart('search');

            this.#searchText = '';
            search.value = '';
            this.#showOptions();
            panel.hidden = false;
            this.#getPart('trigger').setAttribute('aria-expanded', 'true');
            document.addEventListener('mousedown', this.#onDocumentMouseDown);
            search.focus();
        }
    }

    if (!customElements.get(COMPONENT_NAME)) {
        customElements.define(COMPONENT_NAME, G4TagFilter);
    }
})();
