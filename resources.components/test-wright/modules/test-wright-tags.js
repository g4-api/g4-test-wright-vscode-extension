'use strict';

/*
 * Tag and text filtering of the bots tree. Tags come from each bot's reference.tags; bots without
 * tags are grouped under "untagged" (the desktop app's "unmarked").
 */

// Pseudo-tag for bots without tags.
const UNTAGGED = 'untagged';

/**
 * Orders tags: selected first, then A-Z, with "untagged" last.
 *
 * @param {string} left - First tag.
 * @param {string} right - Second tag.
 * @returns {number} Sort order.
 */
function compareTags(left, right) {
    const leftSelected = state.selectedTags.has(left);
    const rightSelected = state.selectedTags.has(right);

    if (leftSelected !== rightSelected) {
        return leftSelected ? -1 : 1;
    }

    if (left === UNTAGGED) {
        return 1;
    }

    if (right === UNTAGGED) {
        return -1;
    }

    return left.localeCompare(right);
}

/**
 * Returns the tags of a bot (or the untagged pseudo-tag).
 *
 * @param {object} test - The bot.
 * @returns {string[]} Its tags.
 */
function getTestTags(test) {
    return test.tags?.length ? test.tags : [UNTAGGED];
}

/**
 * Builds the tag filter items from the discovered bots.
 *
 * @returns {Array<{name: string, count: number, selected: boolean}>} The items.
 */
function getTagItems() {
    const counts = new Map();

    state.tests.forEach((test) => {
        getTestTags(test).forEach((tag) => counts.set(tag, (counts.get(tag) || 0) + 1));
    });

    return [...counts.keys()]
        .sort(compareTags)
        .map((name) => ({ name, count: counts.get(name), selected: state.selectedTags.has(name) }));
}

/**
 * Returns the bots that pass the text and tag filters.
 *
 * @returns {Array<object>} The visible bots.
 */
function getVisibleTests() {
    const query = state.filterText.trim().toLowerCase();

    return state.tests.filter((test) => {
        const isTagMatch = state.selectedTags.size === 0 || getTestTags(test).some((tag) => state.selectedTags.has(tag));
        const haystack = [test.name, test.file, test.suite, ...(test.tags || [])].join(' ').toLowerCase();

        return isTagMatch && (query === '' || haystack.includes(query));
    });
}

/**
 * Applies a tag filter action (toggle, select all, clear).
 *
 * @param {CustomEvent} event - g4-action from <g4-tag-filter>.
 * @returns {void}
 */
function resolveTagAction(event) {
    const detail = event.detail;

    if (detail.id === 'toggle') {
        if (state.selectedTags.has(detail.name)) {
            state.selectedTags.delete(detail.name);
        } else {
            state.selectedTags.add(detail.name);
        }
    } else if (detail.id === 'select-all') {
        detail.names.forEach((name) => state.selectedTags.add(name));
    } else if (detail.id === 'clear') {
        state.selectedTags.clear();
    }

    showApp();
}

/**
 * Refreshes the tag filter items.
 *
 * @returns {void}
 */
function showTags() {
    elements['tag-filter'].items = getTagItems();
}
