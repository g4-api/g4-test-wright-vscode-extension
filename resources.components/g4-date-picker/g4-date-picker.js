/*
 * G4(TM) date picker component: <g4-date-picker>.
 *
 * A "YYYY-MM-DD HH:MM" text box (local time) with a calendar popup: a month grid, an hour and
 * minute row, and Clear / Now / Apply. Typing is allowed; the popup is a convenience.
 *
 * Contract:
 * - Attributes: value, placeholder, allow-past (days before today stay selectable), label
 *   (accessible name), test-id (prefix of every part's data-test-id).
 * - Properties: value (the text), date (the parsed Date, or null when the text is not a date).
 * - Methods: focus(), close().
 * - Events (bubble): g4-input { value } whenever the user types or applies a value.
 */
(() => {
    'use strict';

    // Component name: the custom element tag, the template id prefix, and the default test id prefix.
    const COMPONENT_NAME = 'g4-date-picker';

    // Accepted text: a date, optionally followed by a time. Linear: fixed-width digit groups only.
    const DATE_TIME_PATTERN = /^(\d{4})-(\d{2})-(\d{2})(?:[ T](\d{2}):(\d{2}))?$/;

    // Weekday headers, Monday first.
    const WEEKDAYS = ['Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa', 'Su'];

    /**
     * Pads a number to two digits.
     *
     * @param {number} value - Number.
     * @returns {string} Two-digit text.
     */
    const pad = (value) => String(value).padStart(2, '0');

    /**
     * Formats a date as "YYYY-MM-DD HH:MM" in local time.
     *
     * @param {Date} date - Date.
     * @returns {string} The text.
     */
    const formatDateTime = (date) => `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())} ` +
        `${pad(date.getHours())}:${pad(date.getMinutes())}`;

    /**
     * Parses "YYYY-MM-DD[ HH:MM]" as local time.
     *
     * @param {string} text - Text.
     * @returns {Date | null} The date, or null when the text is not a valid date.
     */
    const parseDateTime = (text) => {
        const match = DATE_TIME_PATTERN.exec(`${text ?? ''}`.trim());

        if (!match) {
            return null;
        }

        const [year, month, day, hour, minute] = match.slice(1).map((part) => Number(part || 0));
        const date = new Date(year, month - 1, day, hour, minute, 0, 0);

        return date.getMonth() === month - 1 ? date : null;
    };

    /**
     * Date and time picker element.
     */
    class G4DatePicker extends HTMLElement {
        // Whether the template has been rendered into this element.
        #isRendered = false;

        // First day of the month shown in the popup.
        #month = new Date();

        // Day picked in the popup (time comes from the time row).
        #pickedDay = null;

        // Closes the popup when the user clicks outside the picker.
        #onDocumentMouseDown = (event) => {
            if (!this.contains(event.target)) {
                this.close();
            }
        };

        /**
         * The parsed value.
         *
         * @returns {Date | null} The date, or null.
         */
        get date() {
            return parseDateTime(this.value);
        }

        /**
         * The text value.
         *
         * @returns {string} "YYYY-MM-DD HH:MM", or whatever the user typed.
         */
        get value() {
            return this.#getPart('input')?.value ?? this.getAttribute('value') ?? '';
        }

        /**
         * Sets the text (no g4-input: the owner made the change).
         *
         * @param {string} text - New text.
         */
        set value(text) {
            const input = this.#getPart('input');

            if (input) {
                input.value = text ?? '';
            } else {
                this.setAttribute('value', text ?? '');
            }
        }

        /**
         * Closes the popup.
         */
        close() {
            const popup = this.#getPart('popup');

            if (popup && !popup.hidden) {
                popup.hidden = true;
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
            const input = content.querySelector('[data-part="input"]');

            input.value = this.getAttribute('value') ?? '';
            input.placeholder = this.getAttribute('placeholder') ?? 'YYYY-MM-DD HH:MM';
            input.setAttribute('aria-label', this.getAttribute('label') ?? 'Date and time');
            input.addEventListener('input', () => this.#dispatchInput());
            input.addEventListener('keydown', (event) => {
                if (event.key === 'Escape') {
                    this.close();
                }
            });

            content.querySelector('[data-part="weekdays"]').append(...WEEKDAYS.map((name) => {
                const cell = document.createElement('span');

                cell.textContent = name;

                return cell;
            }));

            content.querySelector('[data-part="toggle"]').addEventListener('click', () => this.#togglePopup());
            content.querySelector('[data-part="previous"]').addEventListener('click', () => this.#moveMonth(-1));
            content.querySelector('[data-part="next"]').addEventListener('click', () => this.#moveMonth(1));
            content.querySelector('[data-part="clear"]').addEventListener('click', () => this.#applyText(''));
            content.querySelector('[data-part="now"]').addEventListener('click', () => {
                const now = new Date();

                // A schedule needs a future time, so "now" means the next whole minute there.
                now.setSeconds(0, 0);

                if (!this.hasAttribute('allow-past')) {
                    now.setMinutes(now.getMinutes() + 1);
                }

                this.#applyText(formatDateTime(now));
            });
            content.querySelector('[data-part="apply"]').addEventListener('click', () => this.#applyPicked());
            content.querySelector('[data-part="popup"]').addEventListener('keydown', (event) => {
                if (event.key === 'Escape') {
                    event.stopPropagation();
                    this.close();
                }
            });

            this.replaceChildren(content);
        }

        /**
         * Stops listening for outside clicks when removed.
         */
        disconnectedCallback() {
            document.removeEventListener('mousedown', this.#onDocumentMouseDown);
        }

        /**
         * Focuses the text box.
         */
        focus() {
            this.#getPart('input')?.focus();
        }

        /**
         * Applies the picked day with the time row, then closes.
         */
        #applyPicked() {
            const day = this.#pickedDay ?? this.date ?? new Date();
            const hour = Math.min(23, Math.max(0, Number(this.#getPart('hour').value) || 0));
            const minute = Math.min(59, Math.max(0, Number(this.#getPart('minute').value) || 0));
            const date = new Date(day.getFullYear(), day.getMonth(), day.getDate(), hour, minute, 0, 0);

            this.#applyText(formatDateTime(date));
        }

        /**
         * Sets the text, reports it, and closes the popup.
         *
         * @param {string} text - New text.
         */
        #applyText(text) {
            this.#getPart('input').value = text;
            this.#dispatchInput();
            this.close();
        }

        /**
         * Reports the current text.
         */
        #dispatchInput() {
            this.dispatchEvent(new CustomEvent('g4-input', { bubbles: true, detail: { value: this.value } }));
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
         * Shows another month.
         *
         * @param {number} offset - Months to move (negative = back).
         */
        #moveMonth(offset) {
            this.#month = new Date(this.#month.getFullYear(), this.#month.getMonth() + offset, 1);
            this.#showDays();
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
         * Renders the month grid; days before today are disabled unless allow-past is set.
         */
        #showDays() {
            const days = this.#getPart('days');
            const today = new Date();
            const todayStart = new Date(today.getFullYear(), today.getMonth(), today.getDate());
            const isPastAllowed = this.hasAttribute('allow-past');
            const firstWeekday = (new Date(this.#month.getFullYear(), this.#month.getMonth(), 1).getDay() + 6) % 7;
            const dayCount = new Date(this.#month.getFullYear(), this.#month.getMonth() + 1, 0).getDate();
            const prefix = this.getAttribute('test-id') || COMPONENT_NAME;

            this.#getPart('month').textContent = this.#month.toLocaleDateString(undefined, { month: 'long', year: 'numeric' });
            days.replaceChildren();

            for (let index = 0; index < firstWeekday; index++) {
                days.append(document.createElement('span'));
            }

            for (let dayNumber = 1; dayNumber <= dayCount; dayNumber++) {
                const day = new Date(this.#month.getFullYear(), this.#month.getMonth(), dayNumber);
                const button = document.createElement('button');
                const isPicked = this.#pickedDay !== null && day.getTime() === new Date(this.#pickedDay.getFullYear(), this.#pickedDay.getMonth(), this.#pickedDay.getDate()).getTime();

                button.type = 'button';
                button.className = 'g4-date-picker__day';
                button.textContent = String(dayNumber);
                button.dataset.testId = `${prefix}-day-${dayNumber}`;
                button.disabled = !isPastAllowed && day < todayStart;
                button.classList.toggle('g4-date-picker__day--today', day.getTime() === todayStart.getTime());
                button.classList.toggle('g4-date-picker__day--picked', isPicked);
                button.addEventListener('click', () => {
                    this.#pickedDay = day;
                    this.#showDays();
                });
                days.append(button);
            }
        }

        /**
         * Opens or closes the popup, starting from the current value.
         */
        #togglePopup() {
            const popup = this.#getPart('popup');

            if (!popup.hidden) {
                this.close();

                return;
            }

            const current = this.date ?? new Date();

            this.#pickedDay = this.date;
            this.#month = new Date(current.getFullYear(), current.getMonth(), 1);
            this.#getPart('hour').value = String(current.getHours());
            this.#getPart('minute').value = pad(current.getMinutes());
            this.#showDays();
            popup.hidden = false;
            document.addEventListener('mousedown', this.#onDocumentMouseDown);
        }
    }

    if (!customElements.get(COMPONENT_NAME)) {
        customElements.define(COMPONENT_NAME, G4DatePicker);
    }
})();
