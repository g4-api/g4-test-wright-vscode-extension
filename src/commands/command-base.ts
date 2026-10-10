import * as vscode from 'vscode';
import { Global } from '../constants/global';
import { Logger } from '../logging/logger';

/**
 * Base class for the Test Wright commands.
 *
 * @remarks
 * Mirrors the G4 Studio command pattern: a subclass sets `command` in its constructor, and
 * `register()` binds that id to `invokeCommand()`, which delegates to `onInvokeCommand()`.
 */
export abstract class CommandBase {
    /** Logger instance scoped to this command. */
    public readonly logger: Logger;

    /** VS Code extension context for registering disposables. */
    public readonly context: vscode.ExtensionContext;

    /** The command identifier used to register in VS Code. */
    public command: string = '';

    /**
     * Creates a new command.
     *
     * @param context - VS Code extension context for lifecycle management.
     */
    constructor(context: vscode.ExtensionContext) {
        this.context = context;
        this.logger = Global.logger.newLogger(`G4.TestWright.${this.constructor.name}`);
    }

    /**
     * Registers this command with VS Code's command registry.
     */
    public register(): void {
        const disposable = vscode.commands.registerCommand(this.command, async (args?: any) => {
            try {
                return await this.invokeCommand(args);
            } catch (error: any) {
                this.logger.error(`Command '${this.command}' failed.`, undefined, error);
                vscode.window.showErrorMessage(`${this.command}: ${error?.message ?? error}`);
            }
        });

        this.context.subscriptions.push(disposable);
    }

    /**
     * Executes this command.
     *
     * @param args - Optional arguments passed by the caller (for example an Explorer URI).
     * @returns The command result.
     */
    public invokeCommand(args?: any): Promise<any> {
        return this.onInvokeCommand(args);
    }

    /** Implementation hook for command invocation. */
    protected abstract onInvokeCommand(args?: any): Promise<any>;
}
