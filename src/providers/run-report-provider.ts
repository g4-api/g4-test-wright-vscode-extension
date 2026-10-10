/*
 * Opens run reports in editor tabs:
 * - the run summary page (resources.components/run-report) for a run.json, and
 * - the G4 automation report (resources.components/automation-report, from G4 Studio) for one bot.
 *
 * The run summary posts { kind: 'action', id, testId? } messages: open-bot, open-allure,
 * convert-allure, reveal-folder, open-json.
 */
import * as fs from 'node:fs/promises';
import * as path from 'node:path';
import * as vscode from 'vscode';
import { AllureConverter } from '../services/allure-converter';
import { AllureReportService } from '../services/allure-report-service';
import { Logger } from '../logging/logger';
import { RepositoryService } from '../services/repository-service';
import { WebviewPages } from '../extensions/webview-pages';

/**
 * Shows run summaries and per-bot G4 reports.
 */
export class RunReportProvider implements vscode.Disposable {
    // Open run summary panels by run.json path (revealed instead of duplicated).
    private readonly _panels = new Map<string, vscode.WebviewPanel>();

    // The extension context.
    private readonly _context: vscode.ExtensionContext;

    // Generates and opens Allure reports.
    private readonly _allureReports: AllureReportService;

    // Named logger.
    private readonly _logger: Logger;

    /**
     * Creates the provider.
     *
     * @param context - The extension context.
     * @param allureReports - The Allure report service.
     * @param logger - Parent logger.
     */
    constructor(context: vscode.ExtensionContext, allureReports: AllureReportService, logger: Logger) {
        this._context = context;
        this._allureReports = allureReports;
        this._logger = logger.newLogger('G4.TestWright.RunReport');
    }

    /**
     * Closes every open run summary.
     */
    public dispose(): void {
        this._panels.forEach((panel) => panel.dispose());
        this._panels.clear();
    }

    /**
     * Opens the G4 automation report of one bot of a run.
     *
     * @param runFile - The run.json path.
     * @param testId - The bot id.
     */
    public async showBotReport(runFile: string, testId: string): Promise<void> {
        const record = await RepositoryService.readRun(runFile);
        const test = record?.tests.find((candidate) => candidate.id === testId);

        if (test === undefined || !test.reportFile) {
            vscode.window.showWarningMessage(`No G4 report was saved for '${testId}' (it did not get an engine response).`);

            return;
        }

        const base64 = await fs.readFile(path.join(path.dirname(runFile), test.reportFile), 'utf8');
        const panel = vscode.window.createWebviewPanel('g4TestWright.botReport', `${test.name} (${record?.name})`, vscode.ViewColumn.Active, {
            enableScripts: true,
            retainContextWhenHidden: true,
            localResourceRoots: WebviewPages.getResourceRoots(this._context)
        });
        const html = WebviewPages.newPageHtml(panel.webview, this._context, 'automation-report');
        const reportJson = Buffer.from(base64.trim(), 'base64').toString('utf8');

        panel.iconPath = WebviewPages.getPanelIcon(this._context);
        panel.webview.html = html.replace('{{$ report.data }}', () => WebviewPages.getEscapedHtml(reportJson));
    }

    /**
     * Opens (or reveals) the run summary of a run.json.
     *
     * @param runFile - The run.json path.
     */
    public async showRunReport(runFile: string): Promise<void> {
        const existing = this._panels.get(runFile);
        const record = await RepositoryService.readRun(runFile);

        if (record === null) {
            vscode.window.showErrorMessage(`'${runFile}' is not a Test Wright run record.`);

            return;
        }

        if (existing !== undefined) {
            existing.webview.html = WebviewPages.newPageHtml(existing.webview, this._context, 'run-report', { record, runFile });
            existing.reveal();

            return;
        }

        const panel = vscode.window.createWebviewPanel('g4TestWright.runReport', `Run ${record.label || record.name}`, vscode.ViewColumn.Active, {
            enableScripts: true,
            retainContextWhenHidden: true,
            localResourceRoots: WebviewPages.getResourceRoots(this._context)
        });

        panel.iconPath = WebviewPages.getPanelIcon(this._context);
        panel.webview.html = WebviewPages.newPageHtml(panel.webview, this._context, 'run-report', { record, runFile });
        panel.webview.onDidReceiveMessage((message) => void this.resolveAction(panel, runFile, message));
        panel.onDidDispose(() => this._panels.delete(runFile));
        this._panels.set(runFile, panel);
    }

    // Handles one run summary action.
    private async resolveAction(panel: vscode.WebviewPanel, runFile: string, message: any): Promise<void> {
        if (message?.kind !== 'action') {
            return;
        }

        const runFolder = path.dirname(runFile);
        const notify = (text: string, kind = 'info'): void => void panel.webview.postMessage({ kind: 'notice', text, level: kind });

        try {
            switch (message.id) {
                case 'open-bot':
                    await this.showBotReport(runFile, message.testId);
                    break;
                case 'open-json':
                    await vscode.window.showTextDocument(vscode.Uri.file(runFile), { preview: true });
                    break;
                case 'reveal-folder':
                    await vscode.commands.executeCommand('revealFileInOS', vscode.Uri.file(runFile));
                    break;
                case 'convert-allure': {
                    const { count } = await AllureConverter.convertRun(runFolder);

                    notify(`Allure results written (${count} result(s)).`);
                    break;
                }
                case 'open-allure': {
                    // openReport converts a run that never collected Allure results.
                    notify('Generating the Allure report...');

                    const result = await this._allureReports.openReport(runFolder, message.browser === true, (text) => this._logger.information(text));

                    notify(result.error ?? 'Allure report opened.', result.error ? 'error' : 'info');
                    break;
                }
                default:
                    break;
            }
        } catch (error: any) {
            this._logger.error(`Run report action '${message.id}' failed.`, undefined, error);
            notify(`${error?.message ?? error}`, 'error');
        }
    }
}
