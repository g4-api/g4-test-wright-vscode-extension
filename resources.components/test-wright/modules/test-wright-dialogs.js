'use strict';

/*
 * Confirm and prompt dialogs built on <g4-modal>.
 */

/**
 * Builds a dialog body with a message, an optional input, and two buttons.
 *
 * @param {object} options - Dialog options.
 * @param {string} options.title - Dialog title.
 * @param {string} options.message - Message text.
 * @param {string} options.confirmLabel - Confirm button text.
 * @param {string} [options.cancelLabel] - Cancel button text.
 * @param {string|null} [options.defaultValue] - Prompt value; null shows no input.
 * @returns {Promise<{ isConfirmed: boolean, value: string }>} The outcome.
 */
function showDialog({ title, message, confirmLabel, cancelLabel = 'Cancel', defaultValue = null }) {
    return new Promise((resolve) => {
        const modal = document.createElement('g4-modal');
        const body = document.createElement('div');
        const text = document.createElement('p');
        const actions = document.createElement('div');
        const cancel = document.createElement('button');
        const confirm = document.createElement('button');
        const focusReturn = document.activeElement;
        let input = null;
        let isSettled = false;

        const settle = (isConfirmed) => {
            if (isSettled) {
                return;
            }

            isSettled = true;
            resolve({ isConfirmed, value: input ? input.value.trim() : '' });
            modal.close();
        };

        modal.setAttribute('modal-title', title);
        modal.setAttribute('size', 'fit');
        modal.setAttribute('test-id', 'dialog');
        body.className = 'dialog-body';
        text.className = 'dialog-message';
        text.textContent = message;
        body.append(text);

        if (defaultValue !== null) {
            input = document.createElement('input');
            input.type = 'text';
            input.className = 'input';
            input.value = defaultValue;
            input.dataset.testId = 'dialog-input';
            input.addEventListener('keydown', (event) => {
                if (event.key === 'Enter') {
                    // Without preventDefault the same Enter activates the button that gets the focus
                    // back when the modal closes (for example Save plan, which reopens this dialog).
                    event.preventDefault();
                    settle(true);
                }
            });
            body.append(input);
        }

        actions.className = 'dialog-actions';
        cancel.type = 'button';
        cancel.className = 'btn btn-secondary';
        cancel.textContent = cancelLabel;
        cancel.dataset.testId = 'dialog-cancel-button';
        cancel.addEventListener('click', () => settle(false));
        confirm.type = 'button';
        confirm.className = 'btn btn-primary';
        confirm.textContent = confirmLabel;
        confirm.dataset.testId = 'dialog-confirm-button';
        confirm.addEventListener('click', () => settle(true));
        actions.append(cancel, confirm);
        body.append(actions);
        modal.append(body);

        // Escape and the Close button close the modal without a choice: treat that as cancel.
        modal.addEventListener('g4-close', () => {
            if (!isSettled) {
                isSettled = true;
                resolve({ isConfirmed: false, value: '' });
            }
        });

        modal.show(focusReturn instanceof HTMLElement ? focusReturn : null);
        (input || confirm).focus();
        input?.select();
    });
}

/**
 * Asks the user to confirm an action.
 *
 * @param {object} options - { title, message, confirmLabel, cancelLabel }.
 * @returns {Promise<boolean>} True when confirmed.
 */
async function confirmDialog(options) {
    const { isConfirmed } = await showDialog({ ...options, defaultValue: null });

    return isConfirmed;
}

/**
 * Asks the user for a text value.
 *
 * @param {object} options - { title, message, defaultValue, confirmLabel }.
 * @returns {Promise<string|null>} The value, or null when canceled.
 */
async function promptDialog(options) {
    const { isConfirmed, value } = await showDialog({ ...options, defaultValue: options.defaultValue || '' });

    return isConfirmed ? value : null;
}
