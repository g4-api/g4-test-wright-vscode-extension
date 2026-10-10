import * as vscode from 'vscode';
import { AllureReportService } from './services/allure-report-service';
import { ConvertRunToAllureCommand, ShowRunReportCommand } from './commands/show-run-report';
import { Global } from './constants/global';
import { RunReportProvider } from './providers/run-report-provider';
import { RunService } from './services/run-service';
import { SchedulerService } from './services/scheduler-service';
import { ShowComponentGalleryCommand } from './commands/show-component-gallery';
import { OpenNewTestWrightCommand, ShowTestWrightCommand } from './commands/show-test-wright';
import { TEST_WRIGHT_VIEW_TYPE, TestWrightPanelProvider } from './providers/test-wright-panel-provider';
import { Utilities } from './extensions/utilities';

/**
 * Entry point of G4 Studio Test Wright.
 *
 * Builds the shared services (runs, scheduler, Allure, run reports), registers the commands, the
 * activity-bar launcher, and the panel serializer, and watches manifest.json so engine and report
 * settings apply without a reload.
 *
 * @param context - The extension context that owns every disposable.
 */
export function activate(context: vscode.ExtensionContext): void {
    const logger = Global.logger;

    // Shared services, disposed with the extension.
    const runService = new RunService(logger);
    const scheduler = new SchedulerService(context, runService, logger);
    const allureReports = new AllureReportService(context, logger);
    const runReports = new RunReportProvider(context, allureReports, logger);
    const panelProvider = new TestWrightPanelProvider({ context, runService, scheduler, allureReports, runReports, logger });

    context.subscriptions.push(runService, scheduler, allureReports, runReports, panelProvider);

    // Commands.
    new ShowTestWrightCommand(context, panelProvider).register();
    new OpenNewTestWrightCommand(context, panelProvider).register();
    new ShowRunReportCommand(context, runReports).register();
    new ConvertRunToAllureCommand(context).register();
    new ShowComponentGalleryCommand(context).register();

    // The component gallery is a development aid: list it only when running from source (F5).
    void vscode.commands.executeCommand('setContext', 'g4TestWright.isDevelopment', context.extensionMode === vscode.ExtensionMode.Development);

    registerLauncher(context, panelProvider);

    // Restore the panel after a window reload.
    context.subscriptions.push(vscode.window.registerWebviewPanelSerializer(TEST_WRIGHT_VIEW_TYPE, {
        deserializeWebviewPanel: async (panel: vscode.WebviewPanel) => panelProvider.restorePanel(panel)
    }));

    registerManifestWatcher(context);
    newProjectFolders();

    logger.information(`G4 Test Wright activated. Engine: ${Utilities.getEngineEndpoint()}, project: ${Utilities.getProjectFolder() || '(no workspace)'}.`);
}

/**
 * Creates the plans repository and reports folders of the G4 project when they are missing, and
 * logs what was created.
 */
const newProjectFolders = (): void => {
    const { created, errors } = Utilities.newProjectFolders();

    created.forEach((folder) => Global.logger.information(`Folder created: ${folder}`));
    errors.forEach((error) => Global.logger.warning(`Folder could not be created: ${error}`));
};

/**
 * Deactivation hook; every resource is disposed through the context subscriptions.
 */
export function deactivate(): void {
    // Nothing beyond the context subscriptions.
}

/**
 * Registers the activity-bar view: an empty tree whose welcome content opens Test Wright.
 *
 * @remarks
 * Clicking the Activity Bar icon while no Test Wright panel is open opens one and collapses the
 * side bar, so the icon goes straight to the page. While a panel is open, the icon reveals it and
 * keeps the side bar open, so its button can open another panel.
 *
 * @param context - The extension context.
 * @param panelProvider - Owns the Test Wright panels.
 */
const registerLauncher = (context: vscode.ExtensionContext, panelProvider: TestWrightPanelProvider): void => {
    const emptyTree: vscode.TreeDataProvider<never> = {
        getTreeItem: (element: never) => element,
        getChildren: () => []
    };
    const launcher = vscode.window.createTreeView('g4TestWrightLauncher', { treeDataProvider: emptyTree });

    // Only visibility changes count: a side bar restored at startup does not open a panel.
    const onVisibilityChanged = (event: vscode.TreeViewVisibilityChangeEvent): void => {
        if (!event.visible) {
            return;
        }

        const hadPanels = panelProvider.hasPanels;

        panelProvider.show();

        if (!hadPanels) {
            void vscode.commands.executeCommand('workbench.action.closeSidebar');
        }
    };

    context.subscriptions.push(launcher, launcher.onDidChangeVisibility(onVisibilityChanged));
};

/**
 * Re-reads the manifest (engine address, token, report folder, log level) when it changes, and
 * creates the project folders a new or moved reports folder needs.
 *
 * @param context - The extension context.
 */
const registerManifestWatcher = (context: vscode.ExtensionContext): void => {
    const watcher = vscode.workspace.createFileSystemWatcher('**/manifest.json');
    const onManifestChanged = (): void => {
        Utilities.updateManifest();
        Global.updateLogger();
        newProjectFolders();
    };

    context.subscriptions.push(
        watcher,
        watcher.onDidChange(onManifestChanged),
        watcher.onDidCreate(onManifestChanged),
        watcher.onDidDelete(onManifestChanged),
        vscode.workspace.onDidChangeWorkspaceFolders(onManifestChanged)
    );
};
