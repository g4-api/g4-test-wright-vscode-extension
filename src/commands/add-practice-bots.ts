import * as fs from 'node:fs/promises';
import * as path from 'node:path';
import * as vscode from 'vscode';
import { CommandBase } from './command-base';
import { TestWrightPanelProvider } from '../providers/test-wright-panel-provider';
import { Utilities } from '../extensions/utilities';

// Practice files shipped with the extension, laid out as they land in a project (bots/ and
// environments/). They live with the learning path that uses them.
const PRACTICE_FOLDER = path.join('resources.docs', 'run-your-bots', 'practice');

/**
 * Copies the practice bots and the Practice environment into the open G4 project
 * (`TestWright.AddPracticeBots`, the launcher's welcome link). The learning path uses them.
 *
 * @remarks
 * The practice bots use the SimulatorDriver, so they need the G4 engine but no browser or driver.
 * Existing files are never overwritten: a learner who edited a practice bot keeps the changes.
 */
export class AddPracticeBotsCommand extends CommandBase {
    // The panel owner (open panels refresh their bots and environments).
    private readonly _panelProvider: TestWrightPanelProvider;

    /**
     * Creates the command.
     *
     * @param context - The extension context.
     * @param panelProvider - Owns the Test Wright panels.
     */
    constructor(context: vscode.ExtensionContext, panelProvider: TestWrightPanelProvider) {
        super(context);
        this.command = 'TestWright.AddPracticeBots';
        this._panelProvider = panelProvider;
    }

    /**
     * Copies the practice files and reports what was added.
     */
    protected async onInvokeCommand(): Promise<void> {
        const projectFolder = Utilities.getProjectFolder();

        if (projectFolder === '' || Utilities.getManifest() === null) {
            vscode.window.showWarningMessage('Open a G4 project (the folder that holds manifest.json) to add the practice bots.');

            return;
        }

        const sourceFolder = path.join(this.context.extensionPath, PRACTICE_FOLDER);
        const files = await AddPracticeBotsCommand.findFiles(sourceFolder);
        const added: string[] = [];
        const skipped: string[] = [];

        for (const relativePath of files) {
            const target = path.join(projectFolder, relativePath);

            try {
                await fs.mkdir(path.dirname(target), { recursive: true });

                // COPYFILE_EXCL fails when the file exists, so a learner's changes are kept.
                await fs.copyFile(path.join(sourceFolder, relativePath), target, fs.constants.COPYFILE_EXCL);
                added.push(relativePath);
            } catch (error: any) {
                if (error?.code !== 'EEXIST') {
                    throw error;
                }

                skipped.push(relativePath);
            }
        }

        this.logger.information(`Practice bots: ${added.length} added, ${skipped.length} already there (${projectFolder}).`);
        this._panelProvider.updateProject();

        const kept = skipped.length > 0 ? ` ${skipped.length} file(s) were already there and were kept.` : '';
        const message = added.length > 0
            ? `Practice bots added to bots/practice, and the Practice environment to environments.${kept}`
            : 'The practice bots are already in this project; nothing was changed.';
        const action = await vscode.window.showInformationMessage(message, 'Open Test Wright');

        if (action === 'Open Test Wright') {
            this._panelProvider.show();
        }
    }

    // Lists the files under a folder as paths relative to it.
    private static async findFiles(folder: string, relativeFolder = ''): Promise<string[]> {
        const entries = await fs.readdir(path.join(folder, relativeFolder), { withFileTypes: true });
        const files: string[] = [];

        for (const entry of entries) {
            const relativePath = path.join(relativeFolder, entry.name);

            if (entry.isDirectory()) {
                files.push(...await AddPracticeBotsCommand.findFiles(folder, relativePath));
            } else if (entry.isFile()) {
                files.push(relativePath);
            }
        }

        return files;
    }
}
