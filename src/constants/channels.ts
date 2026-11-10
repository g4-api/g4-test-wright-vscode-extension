import * as vscode from 'vscode';

import { BrandingService } from '../services/branding-service';

/**
 * Central registry for the output channels used by G4 Test Wright.
 *
 * @remarks
 * The channel uses the `g4log` language (contributed by this extension) so structured log entries are
 * colorized in the Output panel. It is created on first use rather than when this module loads, so its name
 * comes from the branding that activation reads first; a channel keeps its name, so a branding the Hub sends
 * later renames it on the next start.
 */
export class Channels {
    // The extension host channel, created on first use.
    private static _extension: vscode.OutputChannel | undefined;

    /**
     * Output channel for the extension host: discovery, runs, Allure generation, and errors.
     */
    public static get extension(): vscode.OutputChannel {
        // Create the channel once, with its branded display name and the g4log highlighting language.
        Channels._extension ??= vscode.window.createOutputChannel(BrandingService.getText('{testWright}'), 'g4log');

        return Channels._extension;
    }
}
