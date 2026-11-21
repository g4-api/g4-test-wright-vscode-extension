import * as vscode from 'vscode';

import { AddPracticeBotsCommand } from './commands/add-practice-bots';
import { ShowComponentGalleryCommand } from './commands/show-component-gallery';
import {
    ConvertRunToAllureCommand,
    ShowRunReportCommand
} from './commands/show-run-report';
import {
    OpenNewTestWrightCommand,
    ShowTestWrightCommand
} from './commands/show-test-wright';

import { Global } from './constants/global';

import { Utilities } from './extensions/utilities';

import { DocumentsTreeProvider } from './providers/documents-tree-provider';
import { RunReportProvider } from './providers/run-report-provider';
import {
    TEST_WRIGHT_VIEW_TYPE,
    TestWrightPanelProvider
} from './providers/test-wright-panel-provider';

import { AllureReportService } from './services/allure-report-service';
import { BrandingService } from './services/branding-service';
import { ManifestBrandingService } from './services/manifest-branding-service';
import { RunService } from './services/run-service';
import { SchedulerService } from './services/scheduler-service';
import {
    SIDE_PANEL_ICON_SETTING,
    SidePanelIconService
} from './services/side-panel-icon-service';

// The button of the offer to reload the window after the manifest labels changed.
const RELOAD_WINDOW_ACTION = 'Reload Window';

/**
 * Entry point of G4 Studio Test Wright.
 *
 * Builds the shared services (runs, scheduler, Allure, run reports), registers the commands, the
 * activity-bar launcher and Documentation view, and the panel serializer, and watches manifest.json so engine and report
 * settings apply without a reload.
 *
 * @param context - The extension context that owns every disposable.
 */
export function activate(context: vscode.ExtensionContext): void {
    // Read the branding the Hub published last time before any label is created, so the output channel and the
    // panels show it from the first moment.
    BrandingService.initialize(context.globalState);

    // Apply the kept branding to the manifest labels, such as the command prefix and the activity bar tooltip, so an
    // updated extension, which ships the G4 labels, shows the Hub branding again after one reload.
    void updateManifestBrandingAsync(context);

    // Apply the chosen side-panel icon from the local setting or the kept Hub icon; the activity bar shows it from
    // the next start, and panels opened later use it at once.
    void updateSidePanelIconAsync(context);

    // Apply a new local icon choice as soon as the user changes the setting.
    context.subscriptions.push(vscode.workspace.onDidChangeConfiguration((event) => {
        if (event.affectsConfiguration(SIDE_PANEL_ICON_SETTING)) {
            void updateSidePanelIconAsync(context, Utilities.getEngineEndpoint());
        }
    }));

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
    new AddPracticeBotsCommand(context, panelProvider).register();
    new ShowRunReportCommand(context, runReports).register();
    new ConvertRunToAllureCommand(context).register();
    new ShowComponentGalleryCommand(context).register();

    // The component gallery is a development aid: list it only when running from source (F5).
    void vscode.commands.executeCommand('setContext', 'g4TestWright.isDevelopment', context.extensionMode === vscode.ExtensionMode.Development);

    registerLauncher(context, panelProvider);
    new DocumentsTreeProvider(context).register();

    // Restore the panel after a window reload.
    context.subscriptions.push(vscode.window.registerWebviewPanelSerializer(TEST_WRIGHT_VIEW_TYPE, {
        deserializeWebviewPanel: async (panel: vscode.WebviewPanel) => panelProvider.restorePanel(panel)
    }));

    registerManifestWatcher(context, panelProvider);
    newProjectFolders();

    logger.information(`${BrandingService.getText('{testWright}')} activated. Engine: ${Utilities.getEngineEndpoint()}, project: ${Utilities.getProjectFolder() || '(no workspace)'}.`);

    // Refresh the branding from the Hub at the engine address in the background; pages opened afterwards use it,
    // and the manifest labels, the output channel name, and the side-panel icon follow after a reload.
    void updateBrandingAsync(context);

    // Read the branding again whenever the window gains focus, so a branding changed on the Hub reaches this window
    // without a restart. An unchanged branding costs one 304 answer.
    const onWindowStateChange = (state: vscode.WindowState): void => {
        if (state.focused) {
            void updateBrandingAsync(context);
        }
    };

    context.subscriptions.push(vscode.window.onDidChangeWindowState(onWindowStateChange));
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
 * Re-reads the manifest (engine address, token, report folder, log level) when it changes,
 * creates the project folders a new or moved reports folder needs, and sends the new defaults to
 * the open panels.
 *
 * @param context - The extension context.
 * @param panelProvider - Owns the Test Wright panels, which follow the new Reports Folder.
 */
const registerManifestWatcher = (context: vscode.ExtensionContext, panelProvider: TestWrightPanelProvider): void => {
    const watcher = vscode.workspace.createFileSystemWatcher('**/manifest.json');
    const onManifestChanged = (): void => {
        Utilities.updateManifest();
        Global.updateLogger();
        newProjectFolders();
        panelProvider.updateDefaults();
    };

    context.subscriptions.push(
        watcher,
        watcher.onDidChange(onManifestChanged),
        watcher.onDidCreate(onManifestChanged),
        watcher.onDidDelete(onManifestChanged),
        vscode.workspace.onDidChangeWorkspaceFolders(onManifestChanged)
    );
};

/**
 * Reads the Hub branding and applies it to every label that is fixed when VS Code starts.
 *
 * @remarks
 * Runs at activation and whenever the window gains focus. Pages opened from now on follow the new branding at once;
 * the manifest labels and the side-panel icon follow it after a reload. Never throws: an unreachable Hub keeps the
 * branding in use.
 *
 * @param context - The extension context, for the install folder and the global state.
 */
const updateBrandingAsync = async (context: vscode.ExtensionContext): Promise<void> => {
    // Read the Hub branding at the engine address, so the next start uses it before the Hub answers.
    const engineEndpoint = Utilities.getEngineEndpoint();
    const isChanged = await BrandingService.refreshAsync(context.globalState, engineEndpoint);

    // Skip the follow-up work when the branding is unchanged, so a focus change writes nothing.
    if (!isChanged) {
        return;
    }

    // Apply the branding to the manifest labels and the side-panel icon; a local icon setting still wins.
    await updateManifestBrandingAsync(context);
    await updateSidePanelIconAsync(context, engineEndpoint);
};

/**
 * Writes the branded manifest labels and offers a window reload when they changed.
 *
 * @remarks
 * VS Code reads the command prefix, the activity bar tooltip, and the settings title before the extension runs, so a
 * change shows after a reload. The offer does not wait for the user. A development host is skipped, because its
 * install folder is the source checkout, whose package.nls.json keeps the G4 defaults.
 *
 * @param context - The extension context, for the install folder, the global storage, and the mode.
 */
const updateManifestBrandingAsync = async (context: vscode.ExtensionContext): Promise<void> => {
    // Reload the window when the user accepts the offer, so the new labels show at once.
    const onReloadChoice = async (choice: string | undefined): Promise<void> => {
        if (choice === RELOAD_WINDOW_ACTION) {
            await vscode.commands.executeCommand('workbench.action.reloadWindow');
        }
    };

    // Leave a source checkout untouched, so a development run never rewrites the shipped G4 labels.
    if (context.extensionMode !== vscode.ExtensionMode.Production) {
        return;
    }

    // Write the branded labels over the installed ones when they differ.
    const isUpdated = await ManifestBrandingService.updateAsync({
        extensionPath: context.extensionPath,
        getText: (text) => BrandingService.getText(text),
        globalStoragePath: context.globalStorageUri.fsPath,
        logger: Global.logger
    });

    if (!isUpdated) {
        return;
    }

    // Offer the reload without waiting, so activation goes on.
    const message = BrandingService.getText('The {testWright} branding changed. Reload the window to show it in the commands, views, and settings.');

    void vscode.window.showInformationMessage(message, RELOAD_WINDOW_ACTION).then(onReloadChoice);
};

/**
 * Chooses the side-panel icon and copies it over the installed icon files.
 *
 * @remarks
 * Reads the local setting and the Hub branding in use, so the precedence lives in one place. The update never throws,
 * and it writes its outcome to the extension log.
 *
 * @param context - The extension context, for the install folder and the global state.
 * @param hubBaseUrl - The Hub base URL; absent before the Hub answered, when only the kept Hub icon is used.
 */
const updateSidePanelIconAsync = async (context: vscode.ExtensionContext, hubBaseUrl?: string): Promise<void> => {
    // Collect the two choices: the local setting and the icon the Hub branding names.
    const configuredPath = vscode.workspace.getConfiguration().get<string>(SIDE_PANEL_ICON_SETTING) ?? '';
    const hubIcon = BrandingService.getSettings().assets?.testWrightIcon;

    // Apply the winning choice to the installed icon files.
    await SidePanelIconService.updateAsync({
        configuredPath,
        extensionPath: context.extensionPath,
        globalState: context.globalState,
        hubBaseUrl,
        hubIcon,
        logger: Global.logger
    });
};
