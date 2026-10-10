'use strict';

/*
 * Console drawer: visibility, unread indicator, and the writeLog sink every module uses.
 */

/**
 * Reflects the console open/unread state on the drawer, toggle, and edge handle.
 *
 * @returns {void}
 */
function showConsoleState() {
    const wasHidden = elements['console-drawer'].hidden;

    elements['console-drawer'].hidden = !state.consoleOpen;

    // A hidden log cannot scroll, so show the newest lines once the opened drawer is laid out.
    if (wasHidden && state.consoleOpen) {
        requestAnimationFrame(() => elements['console-log'].scrollToEnd());
    }

    elements['console-toggle'].classList.toggle('active', state.consoleOpen);
    elements['console-unread'].hidden = state.consoleOpen || !state.consoleUnread;
    elements['edge-console'].classList.toggle('visible', !state.consoleOpen);
}

/**
 * Toggles the console drawer.
 *
 * @returns {void}
 */
function switchConsole() {
    state.consoleOpen = !state.consoleOpen;

    if (state.consoleOpen) {
        state.consoleUnread = false;
    }

    showConsoleState();
    requestSave();
}

/**
 * Appends a line to the console; flags unread output while the drawer is collapsed.
 *
 * @param {string} text - The line text.
 * @param {string} [kind] - info | pass | fail | warn | muted.
 * @returns {void}
 */
function writeLog(text, kind = '') {
    elements['console-log']?.log(text, kind);

    if (!state.consoleOpen && !state.consoleUnread) {
        state.consoleUnread = true;
        showConsoleState();
    }
}
