/*
 * G4(TM) environment picker component: <g4-environment-picker>.
 *
 * A header-style trigger that shows the selected environment and opens a list of the workspace
 * environments (one per file under environments/). "(none)" sends bots without a default
 * environment. Replaces the desktop Test Wright's Python interpreter picker.
 *
 * Contract:
 * - Attributes: label (trigger caption, default 'Environment'), disabled, test-id (prefix of every
 *   part's data-test-id).
 * - Properties: environments (array of { name, parameterCount, issue? }; an entry with an issue is
 *   listed disabled with the issue as its tooltip), value (selected name, '' = none).
 * - Methods: close().
 * - Events (bubble): g4-change { value } when the user picks an environment;
 *   g4-action { id: 'refresh' | 'open-folder' } from the panel tools.
 */
(() => {
    'use strict';

    // Component name: the custom element tag, the template id prefix, and the default test id prefix.
    const COMPONENT_NAME = 'g4-environment-picker';

    /**
     * Environment picker element.
     */
    class G4EnvironmentPicker extends HTMLElement {
        // Environments offered by the panel.
        #environments = [];

        // Whether the template has been rendered into this element.
        #isRendered = false;

        // Selected environment name ('' = none).
        #value = '';

        // Closes the panel when the user clicks outside the picker.
        #onDocumentMouseDown = (event) => {
            if (!this.contains(event.target)) {
                this.close();
            }
        };

        /**
         * Environments offered by the panel.
         *
         * @returns {{ name: string, parameterCount: number }[]} The environments.
         */
        get environments() {
            return [...this.#environments];
        }

        /**
         * Sets the environments offered by the panel.
         *
         * @param {{ name: string, parameterCount: number }[]} environments - The environments.
         */
        set environments(environments) {
            this.#environments = Array.isArray(environments) ? environments : [];
            this.#showValue();
            this.#showOptions();
        }

        /**
         * Selected environment name.
         *
         * @returns {string} The name, or '' for none.
         */
        get value() {
            return this.#value;
        }

        /**
         * Selects an environment (no g4-change: the owner made the change).
         *
         * @param {string} name - The name, or '' for none.
         */
        set value(name) {
            this.#value = name ?? '';
            this.#showValue();
            this.#showOptions();
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
         * Renders the picker once.
         */
        connectedCallback() {
            // An element moved in the page keeps its rendered parts and listeners.
            if (this.#isRendered) {
                return;
            }

            this.#isRendered = true;

            const content = this.#newContent();

            content.querySelector('[data-part="label"]').textContent = this.getAttribute('label') || 'Environment';
            content.querySelector('[data-part="trigger"]').addEventListener('click', () => this.#togglePanel());
            content.querySelector('[data-part="refresh"]').addEventListener('click', () => this.#dispatchAction('refresh'));
            content.querySelector('[data-part="open-folder"]').addEventListener('click', () => this.#dispatchAction('open-folder'));
            // Escape closes the open panel wherever the focus is inside the component (the trigger
            // keeps the focus after a click, so a listener on the panel alone would miss it).
            this.addEventListener('keydown', (event) => {
                if (event.key === 'Escape' && !this.#getPart('panel').hidden) {
                    this.close();
                    this.#getPart('trigger').focus();
                }
            });

            this.replaceChildren(content);
            this.#showValue();
            this.#showOptions();
        }

        /**
         * Stops listening for outside clicks when removed.
         */
        disconnectedCallback() {
            document.removeEventListener('mousedown', this.#onDocumentMouseDown);
        }

        /**
         * Reports a panel tool.
         *
         * @param {string} id - Tool id.
         */
        #dispatchAction(id) {
            this.close();
            this.dispatchEvent(new CustomEvent('g4-action', { bubbles: true, detail: { id } }));
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
         * Builds one option row.
         *
         * @param {string} name - Environment name ('' = none).
         * @param {string} detail - Text on the right.
         * @param {string} [issue] - Why the environment cannot be used; the row is then disabled.
         * @returns {HTMLButtonElement} The row.
         */
        #newOption(name, detail, issue = '') {
            const option = document.createElement('button');
            const nameElement = document.createElement('span');
            const detailElement = document.createElement('span');
            const prefix = this.getAttribute('test-id') || COMPONENT_NAME;

            option.type = 'button';
            option.className = 'g4-environment-picker__option';
            option.setAttribute('role', 'option');
            option.setAttribute('aria-selected', String(name === this.#value));
            option.dataset.testId = `${prefix}-option-${name || 'none'}`;
            option.classList.toggle('g4-environment-picker__option--selected', name === this.#value);
            nameElement.className = 'g4-environment-picker__option-name';
            nameElement.textContent = name || '(none)';
            detailElement.className = 'g4-environment-picker__option-detail';
            detailElement.textContent = issue ? 'cannot be used' : detail;
            option.append(nameElement, detailElement);

            // An environment the engine cannot take is listed, so the user sees why, but not selectable.
            if (issue) {
                option.disabled = true;
                option.title = issue;
                option.classList.add('g4-environment-picker__option--invalid');

                return option;
            }

            option.addEventListener('click', () => {
                this.#value = name;
                this.#showValue();
                this.close();
                this.dispatchEvent(new CustomEvent('g4-change', { bubbles: true, detail: { value: name } }));
            });

            return option;
        }

        /**
         * Renders the option list.
         */
        #showOptions() {
            const options = this.#getPart('options');

            if (!options) {
                return;
            }

            options.replaceChildren(this.#newOption('', 'no default environment'));

            if (this.#environments.length === 0) {
                const empty = document.createElement('div');

                empty.className = 'g4-environment-picker__empty';
                empty.textContent = 'No environment files under environments/.';
                options.append(empty);

                return;
            }

            this.#environments.forEach((environment) => {
                const count = Number(environment.parameterCount) || 0;

                options.append(this.#newOption(environment.name, `${count} parameter${count === 1 ? '' : 's'}`, environment.issue || ''));
            });
        }

        /**
         * Shows the selected name on the trigger and its enabled state.
         */
        #showValue() {
            const valueElement = this.#getPart('value');
            const trigger = this.#getPart('trigger');

            if (!valueElement) {
                return;
            }

            const isKnown = this.#value === '' || this.#environments.some((environment) => environment.name === this.#value);

            valueElement.textContent = this.#value === '' ? '(none)' : this.#value;
            valueElement.classList.toggle('g4-environment-picker__value--missing', !isKnown);
            trigger.title = isKnown ? `Environment: ${valueElement.textContent}` : `Environment '${this.#value}' was not found under environments/.`;
            trigger.disabled = this.hasAttribute('disabled');
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

            this.#showOptions();
            panel.hidden = false;
            this.#getPart('trigger').setAttribute('aria-expanded', 'true');
            document.addEventListener('mousedown', this.#onDocumentMouseDown);
            panel.querySelector('.g4-environment-picker__option--selected')?.focus();
        }
    }

    if (!customElements.get(COMPONENT_NAME)) {
        customElements.define(COMPONENT_NAME, G4EnvironmentPicker);
    }
})();
