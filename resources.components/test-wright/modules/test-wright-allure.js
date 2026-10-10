'use strict';

/*
 * Allure section: the Collect and Browser toggles, the results folder, and Open. Opening asks the
 * host to generate an Allure 3 report (no Java) from the selected folder: a results folder, a run
 * folder, or the reports folder (every run merged).
 */

/**
 * Returns the folder Open uses: the selected one, else the reports folder.
 *
 * @returns {string} The folder, or an empty string.
 */
function getAllureFolder() {
    return state.allureFolderPath || state.reportsFolderPath || runtime.defaults.reportsFolder || '';
}

/**
 * Opens the Allure report of the selected folder.
 *
 * @returns {Promise<void>}
 */
async function openAllure() {
    const folder = getAllureFolder();

    if (!folder) {
        writeLog('Select an Allure results, run, or reports folder first.', 'warn');

        return;
    }

    // Open stays disabled while generating (showAllure reads the flag, so a re-render during the
    // generation keeps it off) and repeated clicks cannot start duplicate generations.
    runtime.isAllureBusy = true;
    showAllure();

    try {
        await openAllureFolder(folder, state.allureOpenInBrowser, false);
    } finally {
        runtime.isAllureBusy = false;
        showAllure();
    }
}

/**
 * Generates and opens the Allure report of a folder, logging the outcome.
 *
 * @param {string} folder - Results, run, or reports folder.
 * @param {boolean} isBrowser - Open in the external browser.
 * @param {boolean} isThrowing - Rethrow failures (the report viewer shows them).
 * @returns {Promise<void>}
 */
async function openAllureFolder(folder, isBrowser, isThrowing) {
    writeLog(`Opening the Allure report of ${folder}${isBrowser ? ' in your browser' : ' in a VS Code tab'}...`, 'info');

    let result;

    try {
        result = await g4Host.request('allure:open', { folderPath: folder, browser: isBrowser });
    } catch (error) {
        result = { error: error.message };
    }

    if (result?.error) {
        writeLog(`Allure open failed: ${result.error}`, 'fail');

        if (isThrowing) {
            throw new Error(result.error);
        }

        return;
    }

    writeLog(`Allure report served at ${result.url}.`, 'pass');
}

/**
 * Prompts for the Allure folder.
 *
 * @returns {Promise<void>}
 */
async function selectAllureFolder() {
    const folder = await g4Host.request('app:selectFolder', {
        title: 'Select an Allure results, run, or reports folder',
        defaultPath: getAllureFolder() || runtime.defaults.projectFolder
    });

    if (!folder) {
        return;
    }

    state.allureFolderPath = folder;
    writeLog(`Allure folder selected: ${folder}`, 'info');
    showApp();
}

/**
 * Renders the Allure section.
 *
 * @returns {void}
 */
function showAllure() {
    const folder = getAllureFolder();

    elements['allure-folder'].textContent = folder || 'No folder selected';
    elements['btn-select-allure-folder'].title = folder ? `Allure folder: ${folder}` : 'Select an Allure results, run, or reports folder';
    elements['btn-open-allure'].disabled = !folder || runtime.isAllureBusy;
    elements['toggle-allure-collect'].value = state.allureEnabled;
    elements['toggle-allure-browser'].value = state.allureOpenInBrowser;
}
