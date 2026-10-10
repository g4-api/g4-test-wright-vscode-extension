import { Channels } from './channels';
import { ExtensionLogger } from '../logging/extensions-logger';
import { Logger } from '../logging/logger';
import { Utilities } from '../extensions/utilities';

/**
 * Process-wide values shared across the extension host.
 */
export class Global {
    /** Root logger; services and commands create named children with newLogger(). */
    public static logger: Logger = new ExtensionLogger(Channels.extension, 'G4.TestWright', Utilities.getLogSettings());

    /**
     * Rebuilds the root logger after the manifest changes (log level and source filters).
     */
    public static updateLogger(): void {
        Global.logger = new ExtensionLogger(Channels.extension, 'G4.TestWright', Utilities.getLogSettings());
    }
}
