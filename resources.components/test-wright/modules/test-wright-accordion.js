'use strict';

/*
 * Repositories accordion: keeps <g4-accordion> in sync with the persisted collapsed sections and
 * height weights.
 */

/**
 * Opens the reports section after a manual run, unless the column is hidden or it is already open.
 *
 * @returns {void}
 */
function openReportsSection() {
    if (!state.showRepo || !state.collapsedSections.has('reports')) {
        return;
    }

    state.collapsedSections.delete('reports');
    showAccordion();
    requestSave();
}

/**
 * Pushes the collapsed sections and weights into the accordion.
 *
 * @returns {void}
 */
function showAccordion() {
    const accordion = elements['repo-accordion'];

    accordion.weights = state.accordionSizes;
    accordion.collapsed = [...state.collapsedSections];
}

/**
 * Stores the accordion state the user changed.
 *
 * @param {CustomEvent} event - g4-change { collapsed, weights }.
 * @returns {void}
 */
function setAccordionState(event) {
    state.collapsedSections = new Set(event.detail.collapsed);
    state.accordionSizes = { ...state.accordionSizes, ...event.detail.weights };
    requestSave();
}

/**
 * Re-lays out the accordion after the column resized.
 *
 * @returns {void}
 */
function updateAccordionLayout() {
    elements['repo-accordion']?.applyLayout();
}
