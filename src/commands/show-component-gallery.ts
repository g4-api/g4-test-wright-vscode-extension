import * as vscode from 'vscode';
import { CommandBase } from './command-base';
import { WebviewPages } from '../extensions/webview-pages';

/**
 * Opens the component gallery (`TestWright.ShowComponentGallery`).
 *
 * @remarks
 * Development aid: renders every g4-* component the Test Wright pages use, with sample data, so a
 * component change can be checked in light, dark, and high-contrast themes without a project. The
 * command is listed in the Command Palette only when the extension runs from source (F5).
 */
export class ShowComponentGalleryCommand extends CommandBase {
    /**
     * Creates the command.
     *
     * @param context - The extension context.
     */
    constructor(context: vscode.ExtensionContext) {
        super(context);
        this.command = 'TestWright.ShowComponentGallery';
    }

    /**
     * Opens the gallery panel.
     */
    protected async onInvokeCommand(): Promise<void> {
        const panel = vscode.window.createWebviewPanel('g4TestWright.gallery', 'Test Wright Components', vscode.ViewColumn.Active, {
            enableScripts: true,
            localResourceRoots: WebviewPages.getResourceRoots(this.context)
        });

        panel.webview.html = WebviewPages.newPageHtml(panel.webview, this.context, 'component-gallery');
        panel.webview.onDidReceiveMessage((message) => {
            if (message?.kind === 'console') {
                this.logger.information(`gallery: ${message.text}`);
            }
        });
    }
}
