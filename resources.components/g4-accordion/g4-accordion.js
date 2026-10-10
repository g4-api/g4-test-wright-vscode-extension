/*
 * G4(TM) accordion component: <g4-accordion>.
 *
 * Stacks the page's child sections. Each section gets a header that collapses or expands it; open
 * sections share the height by weight, and a sash between two open neighbors moves height between
 * them. A collapsed section keeps only its header.
 *
 * Usage:
 *   <g4-accordion test-id="repositories">
 *       <div data-section-id="plans" data-heading="Test Plans Repository">...body...</div>
 *       <div data-section-id="reports" data-heading="Test Reports Repository">...body...</div>
 *   </g4-accordion>
 *
 * Contract:
 * - Attributes: test-id (prefix of every part's data-test-id; sections add their id).
 * - Properties: collapsed (array of collapsed section ids), weights (object of open-section height
 *   weights by id). Setting either re-lays the sections out without an event.
 * - Methods: applyLayout() recomputes heights (call after the container resizes).
 * - Events (bubble): g4-change { collapsed, weights } after a header click or a sash drag.
 */
(() => {
    'use strict';

    // Component name: the custom element tag, the template id prefix, and the default test id prefix.
    const COMPONENT_NAME = 'g4-accordion';

    // Height of a collapsed section (its header), in pixels.
    const HEADER_HEIGHT_PIXELS = 34;

    // Smallest height an open section is given while space allows, in pixels.
    const MINIMUM_OPEN_HEIGHT_PIXELS = 120;

    // Smallest weight kept, so a section can never be weighted away entirely.
    const MINIMUM_WEIGHT = 0.0001;

    /**
     * Clamps a number into a range.
     *
     * @param {number} value - Value.
     * @param {number} minimum - Lower bound.
     * @param {number} maximum - Upper bound.
     * @returns {number} The clamped value.
     */
    const getClampedValue = (value, minimum, maximum) => Math.min(Math.max(value, minimum), maximum);

    /**
     * Accordion element.
     */
    class G4Accordion extends HTMLElement {
        // Collapsed section ids.
        #collapsed = new Set();

        // Whether the sections have been rendered.
        #isRendered = false;

        // Rendered sections in order: { id, element, header }.
        #sections = [];

        // Rendered sashes: { element, above, below }.
        #sashes = [];

        // Open-section weights by id.
        #weights = {};

        // Re-lays out when the accordion itself changes size.
        #resizeObserver = new ResizeObserver(() => this.applyLayout());

        /**
         * Collapsed section ids.
         *
         * @returns {string[]} The ids.
         */
        get collapsed() {
            return [...this.#collapsed];
        }

        /**
         * Sets the collapsed sections (no g4-change: the owner made the change).
         *
         * @param {string[]} ids - Section ids to collapse.
         */
        set collapsed(ids) {
            this.#collapsed = new Set(Array.isArray(ids) ? ids : []);
            this.#refresh();
        }

        /**
         * Open-section weights by id.
         *
         * @returns {Record<string, number>} A copy of the weights.
         */
        get weights() {
            return { ...this.#weights };
        }

        /**
         * Sets the weights (no g4-change).
         *
         * @param {Record<string, number>} weights - Weights by section id.
         */
        set weights(weights) {
            this.#weights = { ...(weights ?? {}) };
            this.applyLayout();
        }

        /**
         * Sizes every section: collapsed sections get their header height, open sections share
         * the rest by weight with a readable minimum.
         */
        applyLayout() {
            const panelHeight = this.clientHeight;

            if (panelHeight <= 0 || this.#sections.length === 0) {
                return;
            }

            const openIds = this.#sections.map((section) => section.id).filter((id) => !this.#collapsed.has(id));
            const availableHeight = panelHeight - (this.#sections.length - openIds.length) * HEADER_HEIGHT_PIXELS
                - this.#getVisibleSashHeight();
            const heights = {};

            this.#sections.forEach((section) => {
                heights[section.id] = HEADER_HEIGHT_PIXELS;
            });

            if (openIds.length === 1) {
                heights[openIds[0]] = availableHeight;
            } else if (openIds.length > 1) {
                const minimumHeight = Math.min(MINIMUM_OPEN_HEIGHT_PIXELS, availableHeight / openIds.length);
                const weights = openIds.map((id) => Math.max(MINIMUM_WEIGHT, this.#weights[id] || 1));
                const weightSum = weights.reduce((sum, weight) => sum + weight, 0);
                let shares = weights.map((weight) => (weight / weightSum) * availableHeight);

                // Keep every open section readable; share only the space above the minimums.
                if (shares.some((height) => height < minimumHeight)) {
                    const remainingHeight = availableHeight - minimumHeight * openIds.length;

                    shares = weights.map((weight) => minimumHeight + (weight / weightSum) * remainingHeight);
                }

                openIds.forEach((id, index) => {
                    heights[id] = shares[index];
                });
            }

            this.#sections.forEach((section) => {
                section.element.style.flexBasis = `${Math.max(HEADER_HEIGHT_PIXELS, heights[section.id])}px`;
            });
        }

        /**
         * Renders the sections once, around the page's children.
         */
        connectedCallback() {
            this.#resizeObserver.observe(this);

            // An element moved in the page keeps its rendered parts and listeners.
            if (this.#isRendered) {
                return;
            }

            this.#isRendered = true;
            this.#render();
            this.#refresh();
        }

        /**
         * Stops watching the size while detached.
         */
        disconnectedCallback() {
            this.#resizeObserver.disconnect();
        }

        /**
         * Reports the current state.
         */
        #dispatchChange() {
            this.dispatchEvent(new CustomEvent('g4-change', {
                bubbles: true,
                detail: { collapsed: this.collapsed, weights: this.weights }
            }));
        }

        /**
         * Starts a sash drag that moves height between its two neighbors.
         *
         * @param {{ element: HTMLElement, above: string, below: string }} sash - The sash.
         * @param {MouseEvent} event - The mousedown event.
         */
        #startSashDrag(sash, event) {
            event.preventDefault();
            sash.element.classList.add('g4-accordion__sash--dragging');
            document.body.style.userSelect = 'none';

            const onMouseMove = (moveEvent) => this.#moveSash(sash, moveEvent);
            const onMouseUp = () => {
                sash.element.classList.remove('g4-accordion__sash--dragging');
                document.body.style.userSelect = '';
                document.removeEventListener('mousemove', onMouseMove);
                document.removeEventListener('mouseup', onMouseUp);
                this.#dispatchChange();
            };

            document.addEventListener('mousemove', onMouseMove);
            document.addEventListener('mouseup', onMouseUp);
        }

        /**
         * Total height of the sashes currently shown.
         *
         * @returns {number} Pixels.
         */
        #getVisibleSashHeight() {
            return this.#sashes
                .filter((sash) => sash.element.classList.contains('g4-accordion__sash--visible'))
                .reduce((sum, sash) => sum + sash.element.offsetHeight, 0);
        }

        /**
         * Moves height between a sash's neighbors as the pointer moves.
         *
         * @param {{ element: HTMLElement, above: string, below: string }} sash - The sash.
         * @param {MouseEvent} event - The mousemove event.
         */
        #moveSash(sash, event) {
            const above = this.#sections.find((section) => section.id === sash.above).element;
            const below = this.#sections.find((section) => section.id === sash.below).element;
            const aboveRect = above.getBoundingClientRect();
            const combinedHeight = aboveRect.height + below.getBoundingClientRect().height;

            if (combinedHeight <= 0) {
                return;
            }

            const minimumHeight = Math.min(MINIMUM_OPEN_HEIGHT_PIXELS, combinedHeight / 2);
            const newAboveHeight = getClampedValue(event.clientY - aboveRect.top, minimumHeight, combinedHeight - minimumHeight);
            const combinedWeight = (this.#weights[sash.above] || 1) + (this.#weights[sash.below] || 1);
            const aboveWeight = combinedWeight * (newAboveHeight / combinedHeight);

            this.#weights[sash.above] = aboveWeight;
            this.#weights[sash.below] = combinedWeight - aboveWeight;
            this.applyLayout();
        }

        /**
         * Applies the collapsed state to headers, sections, and sashes, then lays out.
         */
        #refresh() {
            if (!this.#isRendered) {
                return;
            }

            this.#sections.forEach((section) => {
                const isCollapsed = this.#collapsed.has(section.id);

                section.element.classList.toggle('g4-accordion__section--collapsed', isCollapsed);
                section.header.setAttribute('aria-expanded', String(!isCollapsed));
            });

            this.#sashes.forEach((sash) => {
                const isVisible = !this.#collapsed.has(sash.above) && !this.#collapsed.has(sash.below);

                sash.element.classList.toggle('g4-accordion__sash--visible', isVisible);
            });

            this.applyLayout();
        }

        /**
         * Wraps every child section in the section template and puts sashes between them.
         */
        #render() {
            const prefix = this.getAttribute('test-id') || COMPONENT_NAME;
            const children = [...this.children].filter((child) => child.dataset.sectionId);
            const fragment = document.createDocumentFragment();

            children.forEach((child, index) => {
                const id = child.dataset.sectionId;
                const content = document.getElementById(`${COMPONENT_NAME}-section-template`).content.cloneNode(true);
                const element = content.querySelector('[data-part="section"]');
                const header = content.querySelector('[data-part="header"]');

                content.querySelectorAll('[data-test-id]').forEach((part) => {
                    part.dataset.testId = `${prefix}-${id}-${part.dataset.testId}`;
                });

                element.dataset.sectionId = id;
                content.querySelector('[data-part="title"]').textContent = child.dataset.heading ?? id;
                content.querySelector('[data-part="body"]').append(child);
                header.addEventListener('click', () => {
                    if (this.#collapsed.has(id)) {
                        this.#collapsed.delete(id);
                    } else {
                        this.#collapsed.add(id);
                    }

                    this.#refresh();
                    this.#dispatchChange();
                });

                // A sash sits between this section and the previous one.
                if (index > 0) {
                    const sashContent = document.getElementById(`${COMPONENT_NAME}-sash-template`).content.cloneNode(true);
                    const sashElement = sashContent.querySelector('[data-part="sash"]');
                    const sash = { element: sashElement, above: children[index - 1].dataset.sectionId, below: id };

                    sashElement.dataset.testId = `${prefix}-${sash.above}-${id}-sash`;
                    sashElement.addEventListener('mousedown', (event) => this.#startSashDrag(sash, event));
                    this.#sashes.push(sash);
                    fragment.append(sashContent);
                }

                this.#sections.push({ id, element, header });
                fragment.append(content);
            });

            this.replaceChildren(fragment);
        }
    }

    if (!customElements.get(COMPONENT_NAME)) {
        customElements.define(COMPONENT_NAME, G4Accordion);
    }
})();
