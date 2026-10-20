/*
 * G4(TM) data sheet component: <g4-data-sheet>.
 *
 * The iterations of a plan as rows. Each plan item that reads data gets a column group under its own
 * header ("#4 login"), so every item has its own table while all tables share the same iterations.
 * Each row starts with the iteration number, an Include switch, and Duplicate and Remove buttons.
 * Requires <g4-toggle> on the page (the Include switch).
 * Empty cells of included iterations are marked, because a run with empty values is refused.
 *
 * Contract:
 * - Attributes: test-id (prefix of every part's data-test-id).
 * - Properties: model (set) = { iterations: [{ include }], groups: [{ key, title, subtitle, columns,
 *   rows }] }, where rows holds one { column: value } object per iteration. Setting the model renders
 *   the sheet; the component never changes the page state itself.
 * - Methods: focusGroup(key) scrolls to a group and focuses its first cell.
 * - Events (bubble): g4-change with detail { action, ... }:
 *     { action: 'value', key, iteration, column, value }  a cell was edited (no re-render)
 *     { action: 'include', iteration, value }              an Include switch changed
 *     { action: 'add' }                                    Add Iteration was clicked
 *     { action: 'duplicate', iteration }                   a row's Duplicate was clicked
 *     { action: 'remove', iteration }                      a row's Remove was clicked
 *     { action: 'copy', from, to }                         a group copies another group's values
 *   After a structural action the page applies it to its state and sets the model again.
 */
(() => {
    'use strict';

    // Component name: the custom element tag, the template id prefix, and the default test id prefix.
    const COMPONENT_NAME = 'g4-data-sheet';

    // Value of the Copy From list's first option, which only names the action.
    const COPY_PROMPT_VALUE = '';

    /**
     * Returns a group's column signature: its column names, lower case, in order.
     *
     * @param {object} group - A sheet group.
     * @returns {string} The signature; groups with equal signatures can copy each other's values.
     *
     * @remarks
     * Column names are word characters only (the engine's placeholder rule), so '|' cannot appear in
     * a name and keeps the joined names unambiguous.
     */
    const getColumnSignature = (group) => group.columns.map((column) => column.toLowerCase()).join('|');

    /**
     * Creates an icon element from the component's icon template.
     *
     * @param {string} name - The icon name (add, duplicate, remove).
     * @returns {Node} A clone of the icon, or an empty text node when the icon is missing.
     */
    const newIcon = (name) => {
        const template = document.getElementById(`${COMPONENT_NAME}-icons-template`);
        const icon = template?.content.querySelector(`[data-icon-name="${name}"]`);

        return icon ? icon.cloneNode(true) : document.createTextNode('');
    };

    /**
     * Iterations sheet element.
     */
    class G4DataSheet extends HTMLElement {
        // Whether the template has been rendered into this element.
        #isRendered = false;

        // The model last set by the page; cells edit it in place so typing never re-renders.
        #model = { iterations: [], groups: [] };

        // Rendered parts of the template, looked up once.
        #parts = {};

        /**
         * The sheet model: { iterations: [{ include }], groups: [{ key, title, subtitle, columns, rows }] }.
         *
         * @returns {object} The current model.
         */
        get model() {
            return this.#model;
        }

        /**
         * Sets the sheet model and renders it.
         *
         * @param {object} value - The new model.
         */
        set model(value) {
            this.#model = {
                iterations: Array.isArray(value?.iterations) ? value.iterations : [],
                groups: Array.isArray(value?.groups) ? value.groups : []
            };

            // Render now when attached; a detached element renders when it is attached.
            if (this.#isRendered) {
                this.#renderSheet();
            }
        }

        /**
         * Renders the frame once, when the element is first attached.
         */
        connectedCallback() {
            // An element moved in the page keeps its rendered parts and listeners.
            if (this.#isRendered) {
                return;
            }

            this.#isRendered = true;
            this.#renderFrame();
            this.#renderSheet();
        }

        /**
         * Scrolls to a group and focuses its first cell.
         *
         * @param {string} key - The group key (plan item key).
         */
        focusGroup(key) {
            const header = this.querySelector(`th[data-group-key="${CSS.escape(key)}"]`);
            const cell = this.querySelector(`input[data-group-key="${CSS.escape(key)}"]`);

            // Bring the group's header into view, then put the cursor in its first cell.
            header?.scrollIntoView({ block: 'nearest', inline: 'start' });
            cell?.focus();
        }

        /**
         * Sends a g4-change event that bubbles to the page.
         *
         * @param {object} detail - The change.
         */
        #dispatchChange(detail) {
            this.dispatchEvent(new CustomEvent('g4-change', { bubbles: true, detail }));
        }

        /**
         * Returns the test id prefix of this element.
         *
         * @returns {string} The test-id attribute, or the component name.
         */
        #getPrefix() {
            return this.getAttribute('test-id') || COMPONENT_NAME;
        }

        /**
         * Builds the second header row: the column names of every group.
         *
         * @returns {HTMLTableRowElement} The row.
         */
        #newColumnHeaderRow() {
            const row = document.createElement('tr');

            for (const group of this.#model.groups) {
                group.columns.forEach((column, index) => {
                    const header = document.createElement('th');

                    // Mark the first column of each group, so the sheet draws a line between groups.
                    header.className = 'g4-data-sheet__column';
                    header.classList.toggle('g4-data-sheet__column--first', index === 0);
                    header.textContent = column;
                    header.title = `{{$ columns.${column} }}`;
                    row.append(header);
                });
            }

            return row;
        }

        /**
         * Builds the Copy From list of a group: the other groups with the same columns.
         *
         * @param {object} group - The target group.
         * @returns {HTMLSelectElement|null} The list, or null when no other group has the same columns.
         */
        #newCopyList(group) {
            const signature = getColumnSignature(group);

            // A source is another plan item whose bot reads the same columns.
            const testCopySource = (candidate) => {
                const isOtherGroup = candidate.key !== group.key;
                const isSameColumns = getColumnSignature(candidate) === signature;

                return isOtherGroup && isSameColumns;
            };

            const sources = this.#model.groups.filter(testCopySource);

            if (sources.length === 0) {
                return null;
            }

            const list = document.createElement('select');
            const prompt = document.createElement('option');

            // The first option names the action; picking a source copies and resets the list.
            list.className = 'g4-data-sheet__copy';
            list.title = 'Copy every value of another plan item of this bot into this one';
            list.dataset.testId = `${this.#getPrefix()}-copy-${group.key}`;
            prompt.value = COPY_PROMPT_VALUE;
            prompt.textContent = 'Copy values from...';
            list.append(prompt);

            for (const source of sources) {
                const option = document.createElement('option');

                option.value = source.key;
                option.textContent = source.title;
                list.append(option);
            }

            // Report the picked source, then reset the list so the same source can be picked again.
            list.addEventListener('change', () => {
                const sourceKey = list.value;

                list.value = COPY_PROMPT_VALUE;

                if (sourceKey !== COPY_PROMPT_VALUE) {
                    this.#dispatchChange({ action: 'copy', from: sourceKey, to: group.key });
                }
            });

            return list;
        }

        /**
         * Builds the first header row: a corner cell, then one header per group.
         *
         * @returns {HTMLTableRowElement} The row.
         */
        #newGroupHeaderRow() {
            const row = document.createElement('tr');
            const corner = document.createElement('th');

            // The corner spans both header rows over the iteration controls column.
            corner.className = 'g4-data-sheet__corner';
            corner.rowSpan = 2;
            corner.textContent = 'Iteration';
            row.append(corner);

            // One header per group, spanning its columns, with its Copy From list when one applies.
            for (const group of this.#model.groups) {
                const header = document.createElement('th');
                const label = document.createElement('div');
                const title = document.createElement('span');
                const subtitle = document.createElement('span');
                const copyList = this.#newCopyList(group);

                header.className = 'g4-data-sheet__group';
                header.colSpan = group.columns.length;
                header.dataset.groupKey = group.key;
                header.dataset.testId = `${this.#getPrefix()}-group-${group.key}`;
                title.className = 'g4-data-sheet__group-title';
                title.textContent = group.title;
                subtitle.className = 'g4-data-sheet__group-subtitle';
                subtitle.textContent = group.subtitle ?? '';

                // The label sticks beside the pinned iteration column, so a group scrolled partly out
                // of view still names the plan item its visible columns belong to.
                label.className = 'g4-data-sheet__group-label';
                label.append(title, subtitle);

                if (copyList !== null) {
                    label.append(copyList);
                }

                header.append(label);
                row.append(header);
            }

            return row;
        }

        /**
         * Builds the controls cell of an iteration: number, Include, Duplicate, and Remove.
         *
         * @param {number} index - Zero-based iteration index.
         * @param {boolean} isIncluded - Whether the iteration runs.
         * @returns {HTMLTableCellElement} The cell.
         */
        #newIterationControls(index, isIncluded) {
            const cell = document.createElement('th');
            const number = document.createElement('span');
            const include = document.createElement('g4-toggle');
            const duplicate = this.#newRowButton({ icon: 'duplicate', label: 'Duplicate this iteration', testId: `duplicate-${index + 1}` });
            const remove = this.#newRowButton({ icon: 'remove', label: 'Remove this iteration', testId: `remove-${index + 1}` });

            cell.className = 'g4-data-sheet__controls';
            cell.scope = 'row';
            number.className = 'g4-data-sheet__number';
            number.textContent = `${index + 1}`;
            // The Include switch renders when the cell joins the table, so it is set up by attributes.
            include.className = 'g4-data-sheet__include';
            include.title = 'Include this iteration in the run (for every bot)';
            include.toggleAttribute('compact', true);
            include.toggleAttribute('checked', isIncluded);
            include.setAttribute('aria-label', `Include iteration ${index + 1}`);
            include.setAttribute('test-id', `${this.#getPrefix()}-include-${index + 1}`);

            // Report each control; the page applies it to the plan and renders the sheet again. The
            // switch's own g4-input stops here, so the sheet's only event stays g4-change.
            include.addEventListener('g4-input', (event) => {
                event.stopPropagation();
                this.#dispatchChange({ action: 'include', iteration: index, value: event.detail.value });
            });

            duplicate.addEventListener('click', () => this.#dispatchChange({ action: 'duplicate', iteration: index }));

            remove.addEventListener('click', () => this.#dispatchChange({ action: 'remove', iteration: index }));

            cell.append(number, include, duplicate, remove);

            return cell;
        }

        /**
         * Builds one iteration row: its controls, then one input per column of every group.
         *
         * @param {number} index - Zero-based iteration index.
         * @returns {HTMLTableRowElement} The row.
         */
        #newIterationRow(index) {
            const iteration = this.#model.iterations[index];
            const isIncluded = iteration?.include !== false;
            const row = document.createElement('tr');

            // Dim an excluded iteration, so the rows that run stand out.
            row.className = 'g4-data-sheet__row';
            row.classList.toggle('g4-data-sheet__row--excluded', !isIncluded);
            row.dataset.testId = `${this.#getPrefix()}-iteration-${index + 1}`;
            row.append(this.#newIterationControls(index, isIncluded));

            // One input per column; edits update the model in place and report the value.
            for (const group of this.#model.groups) {
                group.columns.forEach((column, columnIndex) => {
                    row.append(this.#newValueCell({ group, column, columnIndex, index, isIncluded }));
                });
            }

            return row;
        }

        /**
         * Builds an icon-only button of an iteration row.
         *
         * @param {object} options - { icon, label, testId }.
         * @returns {HTMLButtonElement} The button.
         */
        #newRowButton(options) {
            const button = document.createElement('button');

            button.type = 'button';
            button.className = 'g4-data-sheet__row-button';
            button.title = options.label;
            button.setAttribute('aria-label', options.label);
            button.dataset.testId = `${this.#getPrefix()}-${options.testId}`;
            button.append(newIcon(options.icon));

            return button;
        }

        /**
         * Builds the input cell of one column in one iteration.
         *
         * @param {object} options - { group, column, columnIndex, index, isIncluded }.
         * @returns {HTMLTableCellElement} The cell.
         */
        #newValueCell(options) {
            const { group, column, columnIndex, index, isIncluded } = options;
            const cell = document.createElement('td');
            const input = document.createElement('input');
            const rowValues = group.rows[index] ?? {};

            // Mark an empty value of an included iteration, because a run refuses empty values.
            const showEmptyState = () => {
                const isEmpty = input.value === '';
                const isMissingValue = isIncluded && isEmpty;

                input.classList.toggle('g4-data-sheet__input--empty', isMissingValue);
            };

            cell.className = 'g4-data-sheet__cell';
            cell.classList.toggle('g4-data-sheet__cell--first', columnIndex === 0);
            input.type = 'text';
            input.className = 'g4-data-sheet__input';
            input.value = rowValues[column] ?? '';
            input.spellcheck = false;
            input.dataset.groupKey = group.key;
            input.dataset.testId = `${this.#getPrefix()}-cell-${group.key}-${index + 1}-${column}`;
            input.setAttribute('aria-label', `${group.title}, iteration ${index + 1}, ${column}`);
            showEmptyState();

            // Edit the model in place and report the value, without re-rendering, so typing keeps focus.
            input.addEventListener('input', () => {
                group.rows[index] = { ...(group.rows[index] ?? {}), [column]: input.value };
                showEmptyState();
                this.#updateSummary();
                this.#dispatchChange({ action: 'value', key: group.key, iteration: index, column, value: input.value });
            });

            cell.append(input);

            return cell;
        }

        /**
         * Clones the frame template, prefixes its test ids, and wires the Add Iteration button.
         */
        #renderFrame() {
            const template = document.getElementById(`${COMPONENT_NAME}-template`);
            const content = template.content.cloneNode(true);
            const prefix = this.#getPrefix();

            // Every part gets a unique, descriptive test id under this element's prefix.
            content.querySelectorAll('[data-test-id]').forEach((element) => {
                element.dataset.testId = `${prefix}-${element.dataset.testId}`;
            });

            // Fill the icon placeholders, then keep the parts the sheet renders into.
            content.querySelectorAll('[data-icon]').forEach((placeholder) => placeholder.replaceWith(newIcon(placeholder.dataset.icon)));
            content.querySelectorAll('[data-part]').forEach((element) => {
                this.#parts[element.dataset.part] = element;
            });

            // Report Add Iteration; the page adds the iteration and sets the model again.
            this.#parts.add.addEventListener('click', () => this.#dispatchChange({ action: 'add' }));

            this.replaceChildren(content);
        }

        /**
         * Renders the header rows, the iteration rows, the empty message, and the summary.
         */
        #renderSheet() {
            const { head, body, empty, add, table } = this.#parts;
            const hasGroups = this.#model.groups.length > 0;
            const hasIterations = this.#model.iterations.length > 0;
            const isSheetReady = hasGroups && hasIterations;

            // Explain why the sheet is empty instead of showing a bare table.
            empty.hidden = isSheetReady;
            table.hidden = !hasGroups;
            add.disabled = !hasGroups;

            if (!hasGroups) {
                empty.textContent = 'No bot in the plan reads data: add {{$ columns.Name }} placeholders to a bot to give it columns.';
            } else if (!hasIterations) {
                empty.textContent = 'No iterations: the plan runs once, and each bot uses its own data source. Add an iteration to run the suite with data.';
            }

            // Rebuild the header and rows from the model.
            head.replaceChildren(this.#newGroupHeaderRow(), this.#newColumnHeaderRow());
            body.replaceChildren(...this.#model.iterations.map((_, index) => this.#newIterationRow(index)));
            this.#updateSummary();
        }

        /**
         * Shows how many iterations run and how many included cells are still empty.
         */
        #updateSummary() {
            const iterations = this.#model.iterations;
            const includedCount = iterations.filter((iteration) => iteration?.include !== false).length;
            let emptyCount = 0;

            // Count the empty cells of included iterations only: excluded ones never run.
            iterations.forEach((iteration, index) => {
                if (iteration?.include === false) {
                    return;
                }

                for (const group of this.#model.groups) {
                    const rowValues = group.rows[index] ?? {};

                    emptyCount += group.columns.filter((column) => (rowValues[column] ?? '') === '').length;
                }
            });

            // Show the counts, and turn the summary to a warning while empty values remain.
            const hasEmptyValues = emptyCount > 0;
            const emptyText = hasEmptyValues ? ` - ${emptyCount} empty value(s) to fill` : '';

            this.#parts.summary.textContent = `${includedCount} of ${iterations.length} iteration(s) included${emptyText}`;
            this.#parts.summary.classList.toggle('g4-data-sheet__summary--warning', hasEmptyValues);
        }
    }

    if (!customElements.get(COMPONENT_NAME)) {
        customElements.define(COMPONENT_NAME, G4DataSheet);
    }
})();
