/*
 * Hosts the Test Wright page in one editor panel and routes its requests to the services.
 *
 * Protocol (webview <-> host, see resources.components/test-wright/modules/test-wright-client.js):
 * - Request:  { kind: 'request', id, type, payload }  -> Response: { kind: 'response', id, result } or { kind: 'response', id, error }
 * - Event:    { kind: 'event', type, payload }         (host -> webview: run:event, run:active, schedules:changed, reports:changed)
 *
 * RESOURCES:
 * Webview API: https://code.visualstudio.com/api/extension-guides/webview
 */
import * as os from 'node:os';
import * as path from 'node:path';
import * as vscode from 'vscode';
import { existsSync } from 'node:fs';
import { AllureConverter } from '../services/allure-converter';
import { AllureReportService } from '../services/allure-report-service';
import { BotsDiscoveryService } from '../services/bots-discovery-service';
import { DataSetService } from '../services/data-set-service';
import { G4Client } from '../clients/g4-client';
import { Logger } from '../logging/logger';
import { MAXIMUM_SCHEDULES, SchedulerService } from '../services/scheduler-service';
import { DataFile, PlanFile, RunRequest } from '../models/test-wright-models';
import { RepositoryService } from '../services/repository-service';
import { RunReportProvider } from './run-report-provider';
import { RunService } from '../services/run-service';
import { Utilities } from '../extensions/utilities';
import { WebviewPages } from '../extensions/webview-pages';

// Workspace state key of the persisted page session (folders, plan, layout).
const SESSION_STATE_KEY = 'g4TestWright.session';

// G4 Engine Client (g4-api.g4-engine-client): the command that opens a JSON bot in the Workflow
// Editor, and the custom editor that opens .g4/.g4bot bots.
const G4_SHOW_WORKFLOW_COMMAND = 'Show-Workflow';
const G4_WORKFLOW_EDITOR_VIEW_TYPE = 'g4.workflowEditor';

// The page's view type (also used to restore the panel after a reload).
export const TEST_WRIGHT_VIEW_TYPE = 'g4TestWright.panel';

// Title of the first panel; later panels add their number, as in 'G4 Test Wright (2)'.
const PANEL_TITLE = 'G4 Test Wright';

// Reads the number at the end of a panel title ('G4 Test Wright (3)' -> 3). Linear: anchored, one digit run.
const PANEL_NUMBER_PATTERN = /\((\d+)\)$/;

/**
 * Owns the Test Wright panels and answers their requests.
 *
 * Several panels may be open at once. Each panel gets the events of the runs it started; scheduled
 * runs (no owner) and scheduler/report changes go to every panel. Panels share one saved session:
 * a new panel starts from the session the last panel saved.
 */
export class TestWrightPanelProvider implements vscode.Disposable {
    // Open panels and the subscriptions tied to each.
    private readonly _panels = new Map<vscode.WebviewPanel, vscode.Disposable[]>();

    // The panel that was active last; the Activity Bar icon reveals it.
    private _lastActivePanel: vscode.WebviewPanel | undefined;

    // The panel that started each run, by run id.
    private readonly _runOwners = new Map<number, vscode.WebviewPanel>();

    // Request handlers by message type; each receives the requesting panel.
    private readonly _handlers: Record<string, (payload: any, panel: vscode.WebviewPanel) => Promise<any>>;

    // Shared services.
    private readonly _context: vscode.ExtensionContext;
    private readonly _runService: RunService;
    private readonly _scheduler: SchedulerService;
    private readonly _allureReports: AllureReportService;
    private readonly _runReports: RunReportProvider;
    private readonly _logger: Logger;

    /**
     * Creates the provider.
     *
     * @param options - The extension context and the shared services.
     */
    constructor(options: PanelProviderOptions) {
        this._context = options.context;
        this._runService = options.runService;
        this._scheduler = options.scheduler;
        this._allureReports = options.allureReports;
        this._runReports = options.runReports;
        this._logger = options.logger.newLogger('G4.TestWright.Panel');
        this._handlers = this.newHandlers();
    }

    /**
     * Whether at least one Test Wright panel is open.
     */
    public get hasPanels(): boolean {
        return this._panels.size > 0;
    }

    /**
     * Closes every panel and releases their subscriptions.
     */
    public dispose(): void {
        [...this._panels.keys()].forEach((panel) => panel.dispose());
    }

    /**
     * Opens a new Test Wright panel, even when others are open.
     */
    public newPanel(): void {
        // Number the panel with the lowest number not in use, so a new panel never repeats an open one's title
        // (counting the open panels did, after the first one was closed).
        const usedNumbers = new Set([...this._panels.keys()]
            .map((openPanel) => TestWrightPanelProvider.getPanelNumber(openPanel.title)));
        let panelNumber = 1;

        while (usedNumbers.has(panelNumber)) {
            panelNumber++;
        }

        const title = panelNumber === 1 ? PANEL_TITLE : `${PANEL_TITLE} (${panelNumber})`;
        const panel = vscode.window.createWebviewPanel(
            TEST_WRIGHT_VIEW_TYPE,
            title,
            vscode.ViewColumn.Active,
            {
                enableScripts: true,
                retainContextWhenHidden: true,
                localResourceRoots: WebviewPages.getResourceRoots(this._context)
            }
        );

        this.attachPanel(panel);
    }

    /**
     * Tells every open panel that project files changed (bots or environments were added), so
     * each one discovers its bots and reads its environments again.
     */
    public updateProject(): void {
        this._panels.forEach((_, panel) => this.postEvent(panel, 'project:changed', null));
    }

    /**
     * Reveals the last active panel, or opens one when none is open.
     */
    public show(): void {
        const panel = this._lastActivePanel ?? this._panels.keys().next().value;

        if (panel === undefined) {
            this.newPanel();

            return;
        }

        panel.reveal();
    }

    /**
     * Adopts a panel VS Code restored after a window reload.
     *
     * @param panel - The restored panel.
     */
    public restorePanel(panel: vscode.WebviewPanel): void {
        panel.webview.options = { enableScripts: true, localResourceRoots: WebviewPages.getResourceRoots(this._context) };
        this.attachPanel(panel);
    }

    // Wires a panel: icon, HTML, message routing, and host events.
    private attachPanel(panel: vscode.WebviewPanel): void {
        panel.iconPath = WebviewPages.getPanelIcon(this._context);
        panel.webview.html = WebviewPages.newPageHtml(panel.webview, this._context, 'test-wright');
        this._lastActivePanel = panel;

        this._panels.set(panel, [
            panel.webview.onDidReceiveMessage((message) => void this.resolveMessage(panel, message)),
            panel.onDidChangeViewState((event) => {
                if (event.webviewPanel.active) {
                    this._lastActivePanel = panel;
                }
            }),
            this._runService.onRunEvent((event) => {
                // A run's events go to the panel that started it; scheduled runs go to every panel.
                const owner = this._runOwners.get(event.runId);

                if (owner === undefined || owner === panel) {
                    this.postEvent(panel, 'run:event', event);
                }
            }),
            this._runService.onActiveRunsChanged((count) => this.postEvent(panel, 'run:active', count)),
            this._scheduler.onDidChange(() => this.postEvent(panel, 'schedules:changed', this.getSchedules())),
            this._scheduler.onDidFinishRun((summary) => this.postEvent(panel, 'reports:changed', summary))
        ]);

        // A run keeps its (closed) owner until it ends, so its events are not broadcast to the
        // other tabs as if it were a scheduled run; run:invoke removes the owner when the run ends.
        panel.onDidDispose(() => {
            this._panels.get(panel)?.forEach((subscription) => subscription.dispose());
            this._panels.delete(panel);

            if (this._lastActivePanel === panel) {
                this._lastActivePanel = this._panels.keys().next().value;
            }
        });
    }

    // Reads the number of a panel from its title: 1 for the first panel, n for 'G4 Test Wright (n)'.
    private static getPanelNumber(title: string): number {
        const match = PANEL_NUMBER_PATTERN.exec(title);

        return match ? Number(match[1]) : 1;
    }

    // Snapshot of the scheduler for the page.
    private getSchedules(): { schedules: any[]; parallel: boolean; maximum: number } {
        return { schedules: this._scheduler.schedules, parallel: this._scheduler.isParallel, maximum: MAXIMUM_SCHEDULES };
    }

    // Builds the request handler table.
    private newHandlers(): Record<string, (payload: any, panel: vscode.WebviewPanel) => Promise<any>> {
        return {
            'app:getDefaults': async () => this.getDefaults(),
            'app:pingEngine': async () => ({ engine: Utilities.getEngineEndpoint(), isAlive: await new G4Client(Utilities.getEngineEndpoint()).ping() }),
            'app:selectFolder': async (payload) => this.selectFolder(payload?.title, payload?.defaultPath),
            'app:openFile': async (payload) => {
                await vscode.window.showTextDocument(vscode.Uri.file(payload.path), { preview: true });

                return true;
            },
            'app:revealFile': async (payload) => {
                await vscode.commands.executeCommand('revealFileInOS', vscode.Uri.file(payload.path));

                return true;
            },
            'bots:find': async (payload) => BotsDiscoveryService.findTests(payload.folderPath),
            'bots:open': async (payload) => this.openBot(payload.path),
            'data:find': async (payload) => ({ bots: await DataSetService.findBotData(Array.isArray(payload?.paths) ? payload.paths : []) }),
            'data:load': async () => this.loadData(),
            'data:save': async (payload) => this.saveDataAs(payload.data, payload.defaultName),
            'environments:find': async () => {
                const folderPath = Utilities.getEnvironmentsFolder();

                return { folderPath, environments: await BotsDiscoveryService.findEnvironments(folderPath) };
            },
            'run:invoke': async (payload: RunRequest, panel) => {
                this._runOwners.set(payload.runId, panel);

                try {
                    return await this._runService.invokeRun(payload);
                } finally {
                    this._runOwners.delete(payload.runId);
                }
            },
            'run:stop': async (payload) => this._runService.stopRun(payload.runId),
            'plans:save': async (payload) => this.savePlanAs(payload.plan, payload.defaultName),
            'plans:saveToFolder': async (payload) => {
                const filePath = path.join(payload.folderPath, payload.fileName);

                // An existing plan is replaced only after the page asked the user.
                if (payload.overwrite !== true && existsSync(filePath)) {
                    return { exists: true, filePath };
                }

                await RepositoryService.writePlan(filePath, payload.plan);

                return { filePath };
            },
            'plans:load': async () => this.loadPlan(),
            'plans:list': async (payload) => ({ plans: await RepositoryService.listPlans(payload.folderPath) }),
            'plans:read': async (payload) => {
                const plan = await RepositoryService.readPlan(payload.path);

                return plan === null ? { error: 'Not a valid Test Wright plan file.' } : { plan };
            },
            'reports:list': async (payload) => ({ reports: await RepositoryService.listReports(payload.folderPath) }),
            'reports:read': async (payload) => {
                const record = await RepositoryService.readRun(payload.path);

                return record === null ? { error: 'Not a valid Test Wright run record.' } : { record };
            },
            'reports:openBot': async (payload) => {
                await this._runReports.showBotReport(payload.runFile, payload.testId);

                return true;
            },
            'reports:openTab': async (payload) => {
                await this._runReports.showRunReport(payload.path);

                return true;
            },
            'allure:convert': async (payload) => AllureConverter.convertRun(path.dirname(payload.runFile)),
            'allure:open': async (payload, panel) => this._allureReports.openReport(payload.folderPath, payload.browser === true,
                (text, kind) => this.postEvent(panel, 'run:event', { runId: 0, type: 'log', text, kind })),
            'state:load': async () => ({ state: this._context.workspaceState.get(SESSION_STATE_KEY) ?? null }),
            'state:save': async (payload) => {
                await this._context.workspaceState.update(SESSION_STATE_KEY, payload);

                return true;
            },
            'schedules:list': async () => this.getSchedules(),
            'schedules:add': async (payload) => ({ error: this._scheduler.addSchedule(payload) }),
            'schedules:remove': async (payload) => {
                this._scheduler.removeSchedule(payload.id);

                return true;
            },
            'schedules:setLabel': async (payload) => {
                this._scheduler.setLabel(payload.id, payload.label);

                return true;
            },
            'schedules:setParallel': async (payload) => {
                await this._scheduler.setParallel(payload.parallel === true);

                return true;
            }
        };
    }

    // Folders and engine defaults the page starts from.
    private getDefaults(): any {
        Utilities.updateManifest();

        return {
            workspaceFolder: Utilities.getWorkspaceFolder(),
            projectFolder: Utilities.getProjectFolder(),
            botsFolder: Utilities.getBotsFolder(),
            environmentsFolder: Utilities.getEnvironmentsFolder(),
            reportsFolder: Utilities.getReportsFolder(),
            plansFolder: Utilities.getPlansFolder(),
            engine: Utilities.getEngineEndpoint(),
            hasManifest: Utilities.getManifest() !== null,
            cpuCount: os.availableParallelism(),
            activeRuns: this._runService.activeRunCount
        };
    }

    // Native open dialog for an iterations data file; the page matches its items to the plan.
    private async loadData(): Promise<any> {
        const picked = await vscode.window.showOpenDialog({
            canSelectMany: false,
            defaultUri: vscode.Uri.file(Utilities.getPlansFolder() || Utilities.getWorkspaceFolder() || os.homedir()),
            filters: { 'Test Wright data': ['json'] },
            title: 'Import iterations data'
        });

        if (picked === undefined || picked.length === 0) {
            return { canceled: true };
        }

        const data = await DataSetService.readDataFile(picked[0].fsPath);

        return data === null ? { error: 'Not a valid Test Wright data file.' } : { filePath: picked[0].fsPath, data };
    }

    // Native open dialog for a plan file.
    private async loadPlan(): Promise<any> {
        const picked = await vscode.window.showOpenDialog({
            canSelectMany: false,
            defaultUri: vscode.Uri.file(Utilities.getPlansFolder() || Utilities.getWorkspaceFolder() || os.homedir()),
            filters: { 'Test Wright plans': ['json'] },
            title: 'Import plan'
        });

        if (picked === undefined || picked.length === 0) {
            return { canceled: true };
        }

        const plan = await RepositoryService.readPlan(picked[0].fsPath);

        return plan === null ? { error: 'Not a valid Test Wright plan file.' } : { filePath: picked[0].fsPath, plan };
    }

    // Opens a bot in the G4 Workflow Editor of the G4 Engine Client extension (g4-api.g4-engine-client):
    // .g4/.g4bot files through its custom editor, .json bots through its Show-Workflow command.
    // Without that extension, or for a file its editor does not take, the bot opens as text.
    private async openBot(filePath: string): Promise<{ editor: 'workflow' | 'text' }> {
        const uri = vscode.Uri.file(filePath);
        const commands = await vscode.commands.getCommands(true);
        const extension = path.extname(filePath).toLowerCase();

        if (commands.includes(G4_SHOW_WORKFLOW_COMMAND)) {
            if (extension === '.json') {
                await vscode.commands.executeCommand(G4_SHOW_WORKFLOW_COMMAND, { fileUri: uri.toString() });

                return { editor: 'workflow' };
            }

            // The custom editor falls back to the text editor itself for a file outside a bots folder.
            await vscode.commands.executeCommand('vscode.openWith', uri, G4_WORKFLOW_EDITOR_VIEW_TYPE);

            return { editor: 'workflow' };
        }

        this._logger.information(`G4 Engine Client not installed: '${filePath}' opens as text.`);
        await vscode.window.showTextDocument(uri, { preview: true });

        return { editor: 'text' };
    }

    // Posts a host event to the page.
    private postEvent(panel: vscode.WebviewPanel, type: string, payload: any): void {
        this.postMessage(panel, { kind: 'event', type, payload });
    }

    // Posts a message unless the panel was closed (a closed panel's webview throws on access, for
    // example when a run the tab started ends after the tab was closed).
    private postMessage(panel: vscode.WebviewPanel, message: any): void {
        if (this._panels.has(panel)) {
            void panel.webview.postMessage(message);
        }
    }

    // Answers one request from the page.
    private async resolveMessage(panel: vscode.WebviewPanel, message: any): Promise<void> {
        if (message?.kind === 'console') {
            this._logger.information(`webview: ${message.text}`);

            return;
        }

        if (message?.kind !== 'request') {
            return;
        }

        const handler = this._handlers[message.type];

        try {
            if (handler === undefined) {
                throw new Error(`Unknown request '${message.type}'.`);
            }

            const result = await handler(message.payload, panel);

            this.postMessage(panel, { kind: 'response', id: message.id, result });
        } catch (error: any) {
            this._logger.error(`Request '${message.type}' failed.`, undefined, error);
            this.postMessage(panel, { kind: 'response', id: message.id, error: `${error?.message ?? error}` });
        }
    }

    // Native save dialog for the iterations data of the plan.
    private async saveDataAs(data: DataFile, defaultName: string): Promise<any> {
        const folder = Utilities.getPlansFolder() || Utilities.getWorkspaceFolder() || os.homedir();
        const picked = await vscode.window.showSaveDialog({
            defaultUri: vscode.Uri.file(path.join(folder, defaultName)),
            filters: { 'Test Wright data': ['json'] },
            title: 'Export iterations data'
        });

        if (picked === undefined) {
            return { canceled: true };
        }

        await DataSetService.writeDataFile(picked.fsPath, data);

        return { filePath: picked.fsPath };
    }

    // Native save dialog for a plan file.
    private async savePlanAs(plan: PlanFile, defaultName: string): Promise<any> {
        const folder = Utilities.getPlansFolder() || Utilities.getWorkspaceFolder() || os.homedir();
        const picked = await vscode.window.showSaveDialog({
            defaultUri: vscode.Uri.file(path.join(folder, defaultName)),
            filters: { 'Test Wright plans': ['json'] },
            title: 'Export plan'
        });

        if (picked === undefined) {
            return { canceled: true };
        }

        await RepositoryService.writePlan(picked.fsPath, plan);

        return { filePath: picked.fsPath };
    }

    // Native folder picker.
    private async selectFolder(title: string | undefined, defaultPath: string | undefined): Promise<string | null> {
        const picked = await vscode.window.showOpenDialog({
            canSelectFiles: false,
            canSelectFolders: true,
            canSelectMany: false,
            defaultUri: defaultPath ? vscode.Uri.file(defaultPath) : undefined,
            title: title ?? 'Select folder'
        });

        return picked?.[0]?.fsPath ?? null;
    }
}

// Compile-time contracts stay after the executable code.

/**
 * Dependencies of the panel provider.
 */
export interface PanelProviderOptions {
    context: vscode.ExtensionContext;
    runService: RunService;
    scheduler: SchedulerService;
    allureReports: AllureReportService;
    runReports: RunReportProvider;
    logger: Logger;
}
