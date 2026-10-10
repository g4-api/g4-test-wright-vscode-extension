/*
 * Builds the automation request for one bot from the bot file, the project manifest, and the
 * selected environment.
 *
 * Merge rules (agreed for Test Wright):
 * - authentication.token: the manifest token always wins when the manifest has one.
 * - everything else (authentication, driverParameters, settings): the bot wins; manifest values
 *   only fill keys the bot leaves out, recursively.
 * - client-only manifest settings (client*, recorderSettings, queueManagerSettings) are never sent.
 * - a selected environment sets settings.environmentsSettings.defaultEnvironment.
 */

// Manifest settings sections that configure the VS Code client, not the engine.
const CLIENT_ONLY_SETTINGS = new Set([
    'clientLogConfiguration',
    'clientLogSettings',
    'clientReportSettings',
    'recorderSettings',
    'queueManagerSettings'
]);

/**
 * Composes engine requests from bots.
 */
export class BotRequestBuilder {
    /**
     * Builds the request body for one bot.
     *
     * @param bot - The parsed bot file (not modified).
     * @param manifest - The parsed project manifest, or null.
     * @param environment - The selected environment name, or an empty string.
     * @returns A new request object.
     */
    public static newRequest(bot: any, manifest: any, environment: string): any {
        const request = structuredClone(bot ?? {});

        if (manifest && typeof manifest === 'object') {
            // Fill authentication gaps, then force the manifest token.
            request.authentication = BotRequestBuilder.fillGaps(request.authentication, manifest.authentication);

            const manifestToken = manifest.authentication?.token;

            if (typeof manifestToken === 'string' && manifestToken.trim() !== '') {
                request.authentication = { ...(request.authentication ?? {}), token: manifestToken };
            }

            request.driverParameters = BotRequestBuilder.fillGaps(request.driverParameters, manifest.driverParameters);
            request.settings = BotRequestBuilder.fillGaps(request.settings, BotRequestBuilder.getEngineSettings(manifest.settings));
        }

        // The engine reads settings.environmentsSettings (plural: G4SettingsModel.EnvironmentsSettings).
        if (environment !== '') {
            request.settings = request.settings ?? {};
            request.settings.environmentsSettings = {
                ...(request.settings.environmentsSettings ?? {}),
                defaultEnvironment: environment
            };
        }

        return request;
    }

    /**
     * Fills the keys a target leaves out from a source, recursively; target values always win.
     *
     * @param target - The value that wins (may be undefined).
     * @param source - The value that fills gaps (may be undefined).
     * @returns A merged copy, or the target when the source has nothing to add.
     */
    public static fillGaps(target: any, source: any): any {
        const isTargetObject = BotRequestBuilder.testPlainObject(target);
        const isSourceObject = BotRequestBuilder.testPlainObject(source);

        if (target === undefined || target === null) {
            return isSourceObject || Array.isArray(source) ? structuredClone(source) : source;
        }

        if (!isTargetObject || !isSourceObject) {
            return target;
        }

        const merged: Record<string, any> = { ...target };

        for (const [key, value] of Object.entries(source)) {
            merged[key] = BotRequestBuilder.fillGaps(merged[key], value);
        }

        return merged;
    }

    // Copies the manifest settings without the client-only sections.
    private static getEngineSettings(settings: any): any {
        if (!BotRequestBuilder.testPlainObject(settings)) {
            return undefined;
        }

        return Object.fromEntries(Object.entries(settings).filter(([key]) => !CLIENT_ONLY_SETTINGS.has(key)));
    }

    // True for {} objects (not arrays, not null).
    private static testPlainObject(value: any): boolean {
        return value !== null && typeof value === 'object' && !Array.isArray(value);
    }
}
