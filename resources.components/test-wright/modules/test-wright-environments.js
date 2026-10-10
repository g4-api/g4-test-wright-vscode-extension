'use strict';

/*
 * Environment picker: lists the workspace environments/ files and keeps the selection. The
 * selected environment becomes settings.environmentsSettings.defaultEnvironment of every bot in a
 * run (the host also syncs the file to the engine before the run).
 */

/**
 * Reflects the environment list and selection on the picker.
 *
 * @returns {void}
 */
function showEnvironment() {
    const picker = elements['environment-picker'];

    picker.environments = state.environments;
    picker.value = state.environment;
}

/**
 * Applies the environment the user picked.
 *
 * @param {CustomEvent} event - g4-change { value }.
 * @returns {void}
 */
function selectEnvironment(event) {
    state.environment = event.detail.value || '';
    writeLog(`Environment: ${state.environment || '(none)'}`, 'info');
    showApp();
}

/**
 * Handles the picker tools (Refresh, Open folder).
 *
 * @param {CustomEvent} event - g4-action { id }.
 * @returns {Promise<void>}
 */
async function resolveEnvironmentAction(event) {
    if (event.detail.id === 'refresh') {
        await updateEnvironments();

        return;
    }

    if (event.detail.id === 'open-folder' && runtime.environmentsFolder) {
        await g4Host.request('app:revealFile', { path: runtime.environmentsFolder });
    }
}

/**
 * Re-reads the environments folder.
 *
 * @returns {Promise<void>}
 */
async function updateEnvironments() {
    try {
        const result = await g4Host.request('environments:find');

        runtime.environmentsFolder = result.folderPath;
        state.environments = result.environments || [];

        // A selection whose file disappeared stays visible (flagged) so the user notices it.
        const selected = state.environments.find((environment) => environment.name === state.environment);

        if (state.environment && !selected) {
            writeLog(`Environment '${state.environment}' was not found under environments/.`, 'warn');
        }

        // A selection the engine cannot take (renamed rules, broken file) is explained, not silently used.
        if (selected?.issue) {
            writeLog(`Environment '${state.environment}' cannot be used: ${selected.issue}`, 'warn');
        }
    } catch (error) {
        state.environments = [];
        writeLog(`Environments scan failed: ${error.message}`, 'warn');
    }

    showEnvironment();
}
