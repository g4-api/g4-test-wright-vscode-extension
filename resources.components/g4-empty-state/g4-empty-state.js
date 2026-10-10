/*
 * G4(TM) empty state component: <g4-empty-state>.
 *
 * A centered placeholder for an empty list: an icon, a heading, and a supporting line.
 *
 * Contract:
 * - Attributes: icon ('folder' | 'search' | 'filter' | 'plan'; omitted = no icon), heading,
 *   subtitle, test-id (prefix of every part's data-test-id).
 * - Properties: none.
 * - Methods: none.
 * - Events: none.
 */
(() => {
    'use strict';

    // Component name: the custom element tag, the template id prefix, and the default test id prefix.
    const COMPONENT_NAME = 'g4-empty-state';

    /**
     * Empty-list placeholder element.
     */
    class G4EmptyState extends HTMLElement {
        // Whether the template has been rendered into this element.
        #isRendered = false;

        /**
         * Renders the placeholder once.
         */
        connectedCallback() {
            // An element moved in the page keeps its rendered parts.
            if (this.#isRendered) {
                return;
            }

            this.#isRendered = true;

            const content = this.#newContent();
            const iconName = this.getAttribute('icon') ?? '';
            const iconTemplate = iconName === '' ? null : document.getElementById(`${COMPONENT_NAME}-icon-${iconName}`);
            const iconHost = content.querySelector('[data-part="icon"]');

            // Unknown or missing icons leave no gap above the heading.
            if (iconTemplate) {
                iconHost.append(iconTemplate.content.cloneNode(true));
            } else {
                iconHost.remove();
            }

            content.querySelector('[data-part="heading"]').textContent = this.getAttribute('heading') ?? '';
            content.querySelector('[data-part="subtitle"]').textContent = this.getAttribute('subtitle') ?? '';
            this.replaceChildren(content);
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
        customElements.define(COMPONENT_NAME, G4EmptyState);
    }
})();
