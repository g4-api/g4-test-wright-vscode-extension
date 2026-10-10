import * as vscode from 'vscode';
import { CommandBase } from './command-base';
import { TestWrightPanelProvider } from '../providers/test-wright-panel-provider';

/**
 * Opens the Test Wright panel (`TestWright.Show`).
 */
export class ShowTestWrightCommand extends CommandBase {
    // The panel owner.
    private readonly _panelProvider: TestWrightPanelProvider;

    /**
     * Creates the command.
     *
     * @param context - The extension context.
     * @param panelProvider - Owns the Test Wright panel.
     */
    constructor(context: vscode.ExtensionContext, panelProvider: TestWrightPanelProvider) {
        super(context);
        this.command = 'TestWright.Show';
        this._panelProvider = panelProvider;
    }

    /**
     * Opens or reveals the panel.
     */
    protected async onInvokeCommand(): Promise<void> {
        this._panelProvider.show();
    }
}

/**
 * Opens another Test Wright panel, even when one is open (`TestWright.OpenNew`, the launcher button).
 */
export class OpenNewTestWrightCommand extends CommandBase {
    // The panel owner.
    private readonly _panelProvider: TestWrightPanelProvider;

    /**
     * Creates the command.
     *
     * @param context - The extension context.
     * @param panelProvider - Owns the Test Wright panels.
     */
    constructor(context: vscode.ExtensionContext, panelProvider: TestWrightPanelProvider) {
        super(context);
        this.command = 'TestWright.OpenNew';
        this._panelProvider = panelProvider;
    }

    /**
     * Opens a new panel.
     */
    protected async onInvokeCommand(): Promise<void> {
        this._panelProvider.newPanel();
    }
}
