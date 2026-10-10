import * as vscode from 'vscode';

/**
 * Central registry for the output channels used by G4 Test Wright.
 *
 * @remarks
 * The channel uses the `g4log` language (contributed by this extension) so structured log entries are
 * colorized in the Output panel.
 */
export class Channels {
    /**
     * Output channel for the extension host: discovery, runs, Allure generation, and errors.
     */
    public static readonly extension: vscode.OutputChannel = vscode.window.createOutputChannel(
        'G4 Test Wright', // Display name in the VS Code Output panel
        'g4log'           // Language mode for syntax highlighting
    );
}
