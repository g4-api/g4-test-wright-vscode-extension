import { Channels } from './channels';
import { ExtensionLogger } from '../logging/extensions-logger';
import { Logger } from '../logging/logger';
import { Utilities } from '../extensions/utilities';

/**
 * Process-wide values shared across the extension host.
 */
export class Global {
    // The root logger, created on first use so the output channel is named from the branding read in activation.
    private static _logger: Logger | undefined;

    /** Root logger; services and commands create named children with newLogger(). */
    public static get logger(): Logger {
        // Create the root logger once; updateLogger replaces it after a manifest change.
        Global._logger ??= new ExtensionLogger(Channels.extension, 'G4.TestWright', Utilities.getLogSettings());

        return Global._logger;
    }

    /**
     * Rebuilds the root logger after the manifest changes (log level and source filters).
     */
    public static updateLogger(): void {
        Global._logger = new ExtensionLogger(Channels.extension, 'G4.TestWright', Utilities.getLogSettings());
    }
}
