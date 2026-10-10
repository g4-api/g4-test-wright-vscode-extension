import * as path from 'node:path';
import * as vscode from 'vscode';
import { AllureConverter } from '../services/allure-converter';
import { CommandBase } from './command-base';
import { RunReportProvider } from '../providers/run-report-provider';

/**
 * Opens the run summary of a run.json (`TestWright.ShowRunReport`, Explorer context menu).
 */
export class ShowRunReportCommand extends CommandBase {
    // Opens run summaries.
    private readonly _runReports: RunReportProvider;

    /**
     * Creates the command.
     *
     * @param context - The extension context.
     * @param runReports - Opens run summaries.
     */
    constructor(context: vscode.ExtensionContext, runReports: RunReportProvider) {
        super(context);
        this.command = 'TestWright.ShowRunReport';
        this._runReports = runReports;
    }

    /**
     * Opens the summary of the selected (or active) run.json.
     *
     * @param uri - The run.json from the Explorer, or undefined for the active editor.
     */
    protected async onInvokeCommand(uri?: vscode.Uri): Promise<void> {
        const target = uri ?? vscode.window.activeTextEditor?.document.uri;

        if (target === undefined || path.basename(target.fsPath).toLowerCase() !== 'run.json') {
            vscode.window.showWarningMessage('Select a Test Wright run.json file.');

            return;
        }

        await this._runReports.showRunReport(target.fsPath);
    }
}

/**
 * Writes Allure results (allure-<run>/results) for a run.json (`TestWright.ConvertRunToAllure`, Explorer context menu).
 */
export class ConvertRunToAllureCommand extends CommandBase {
    /**
     * Creates the command.
     *
     * @param context - The extension context.
     */
    constructor(context: vscode.ExtensionContext) {
        super(context);
        this.command = 'TestWright.ConvertRunToAllure';
    }

    /**
     * Converts the selected (or active) run.
     *
     * @param uri - The run.json from the Explorer, or undefined for the active editor.
     */
    protected async onInvokeCommand(uri?: vscode.Uri): Promise<void> {
        const target = uri ?? vscode.window.activeTextEditor?.document.uri;

        if (target === undefined || path.basename(target.fsPath).toLowerCase() !== 'run.json') {
            vscode.window.showWarningMessage('Select a Test Wright run.json file.');

            return;
        }

        const { resultsFolder, count } = await AllureConverter.convertRun(path.dirname(target.fsPath));

        vscode.window.showInformationMessage(`Allure results written to ${resultsFolder} (${count} result(s)).`);
    }
}
