/*
 * White-label branding for the extension's labels and visible text.
 *
 * The G4 Hub resolves the branding from the Branding section of its appsettings.json and publishes it at
 * GET /api/v4/g4/integration/branding. Test Wright reads it from the engine address in manifest.json (the Hub),
 * keeps a copy in the global state so the next start shows the same labels before the Hub answers, and falls back
 * to the G4 defaults when neither is available. Text names a product through a placeholder such as {testWright}
 * or {engineTm}; only known placeholders are replaced, so identifiers, routes, and other braces never change.
 *
 * RESOURCES:
 * Memento: https://code.visualstudio.com/api/references/vscode-api#Memento
 * Content Security Policy in webviews: https://code.visualstudio.com/api/extension-guides/webview#content-security-policy
 */
import type * as vscode from 'vscode';

// The Hub route that publishes the resolved branding, relative to the Hub base URL.
const BRANDING_ROUTE = 'api/v4/g4/integration/branding';

// The global state key that keeps the last branding the Hub published.
const BRANDING_STATE_KEY = 'g4TestWright.branding';

// How long the branding request may take before the cached or default branding is kept.
const REQUEST_TIMEOUT_MILLISECONDS = 5000;

// Matches one placeholder such as {engineTm}: a bounded run of word characters between braces, so the match runs in
// linear time and never spans text outside one pair of braces.
const TOKEN_PATTERN = /\{(\w{1,64})\}/g;

// Matches the slashes that end a base URL, so the route is joined with exactly one slash. Anchored and a single
// character class, so it runs in linear time.
const TRAILING_SLASHES_PATTERN = /\/+$/;

// The placeholder values the Hub publishes when it has no Branding section, so every label keeps the G4 text.
const DEFAULT_TOKENS: Readonly<Record<string, string>> = {
    engine: 'G4 Engine',
    engineClient: 'G4 Engine Client',
    engineClientTm: 'G4™ Engine Client',
    engineTm: 'G4™ Engine',
    hub: 'G4 Hub',
    hubTm: 'G4™ Hub',
    product: 'G4',
    productTm: 'G4™',
    studio: 'G4 Studio',
    studioTm: 'G4™ Studio',
    testWright: 'G4 Test Wright',
    testWrightTm: 'G4™ Test Wright',
    tm: '™'
};

/**
 * Holds the branding the extension shows and resolves branding placeholders in text.
 *
 * @remarks
 * Static, because labels are resolved everywhere, including the lazily created output channel, and the branding
 * is one value for the whole extension host. Call {@link BrandingService.initialize} first in activation, so
 * labels created during activation already use the cached branding.
 */
export class BrandingService {
    // The branding in use: the default until initialize reads the cache, then the cache, then the Hub's answer.
    private static _settings: BrandingSettings = { tokens: { ...DEFAULT_TOKENS } };

    /**
     * Returns the head markup that brands a webview page: the settings in a meta tag and the branding script.
     *
     * @remarks
     * The pages allow only scripts served from the extension (no inline script), so the settings travel in the
     * `g4-branding` meta tag, HTML-escaped, and resources.components/branding/branding.js reads them. Insert the
     * markup in the head, before the page scripts, so they can call G4Branding.getText.
     *
     * @param scriptUri - The webview URI of resources.components/branding/branding.js.
     * @returns The meta tag and the script element.
     */
    public static getPageHead(scriptUri: string): string {
        // Escape the settings for an attribute value, so no branded name can end the attribute or the tag.
        const settingsText = JSON.stringify(BrandingService._settings)
            .replaceAll('&', '&amp;')
            .replaceAll('"', '&quot;')
            .replaceAll('<', '&lt;')
            .replaceAll('>', '&gt;');

        return `<meta name="g4-branding" content="${settingsText}">\n<script src="${scriptUri}"></script>`;
    }

    /**
     * Returns the branding in use.
     *
     * @returns The branding settings, with every placeholder value filled.
     */
    public static getSettings(): BrandingSettings {
        return BrandingService._settings;
    }

    /**
     * Replaces every known placeholder in the text with its branded value.
     *
     * @remarks
     * A placeholder missing from the branding falls back to its G4 default, and an unknown placeholder is kept
     * as written, so text that uses braces for another purpose never changes.
     *
     * @param text - The text to resolve.
     * @returns The resolved text.
     */
    public static getText(text: string): string {
        // Resolve each placeholder from the branding, then from the G4 defaults, and keep unknown braces as written.
        const tokens = BrandingService._settings.tokens;

        return text.replaceAll(TOKEN_PATTERN, (placeholder: string, tokenName: string) => {
            return tokens[tokenName] ?? DEFAULT_TOKENS[tokenName] ?? placeholder;
        });
    }

    /**
     * Loads the branding the Hub published last time.
     *
     * @remarks
     * Runs first in activation and never fails: a missing or malformed copy keeps the G4 defaults.
     *
     * @param globalState - The extension's global state.
     */
    public static initialize(globalState: vscode.Memento): void {
        // Start from the G4 defaults, so a missing or malformed copy never keeps an earlier branding.
        BrandingService._settings = { tokens: { ...DEFAULT_TOKENS } };

        // Apply the cached copy; setSettings refuses a malformed value and keeps the defaults.
        const cachedSettings = globalState.get<unknown>(BRANDING_STATE_KEY);

        BrandingService.setSettings(cachedSettings);
    }

    /**
     * Reads the branding from the Hub and keeps it for this and the next start.
     *
     * @remarks
     * A Hub that does not answer, answers with an error, or publishes no branding leaves the current branding in
     * place, so an engine without the branding route keeps the G4 labels. Labels created before the refresh, such
     * as the output channel name, change on the next start.
     *
     * @param globalState - The extension's global state that keeps the copy.
     * @param baseUrl - The Hub base URL, for example http://localhost:9944.
     * @returns True when the Hub published a branding that differs from the one kept.
     */
    public static async refreshAsync(globalState: vscode.Memento, baseUrl: string): Promise<boolean> {
        // Skip the request when no Hub is configured.
        if (!baseUrl) {
            return false;
        }

        // Ask the Hub for its branding, with a timeout so a slow Hub never delays the extension.
        const brandingUrl = new URL(BRANDING_ROUTE, `${baseUrl.replace(TRAILING_SLASHES_PATTERN, '')}/`);
        let receivedSettings: unknown;

        try {
            const response = await fetch(brandingUrl, { signal: AbortSignal.timeout(REQUEST_TIMEOUT_MILLISECONDS) });

            // Keep the current branding when the Hub has no branding route or fails, as an older Hub does.
            if (!response.ok) {
                return false;
            }

            receivedSettings = await response.json();
        } catch {
            return false;
        }

        // Apply the answer, and keep it only when it is a branding that differs from the copy already kept.
        const isChanged = JSON.stringify(receivedSettings) !== JSON.stringify(globalState.get<unknown>(BRANDING_STATE_KEY));
        const isApplied = BrandingService.setSettings(receivedSettings);
        const isSaved = isApplied && isChanged;

        if (!isSaved) {
            return false;
        }

        // Persist the new branding for the next start.
        await globalState.update(BRANDING_STATE_KEY, receivedSettings);

        return true;
    }

    /**
     * Replaces the branding when the value is a branding with placeholder values.
     *
     * @param value - The candidate branding, from the Hub or the global state.
     * @returns True when the value was applied.
     */
    private static setSettings(value: unknown): boolean {
        // Refuse anything without a token map, so a malformed answer cannot blank the labels.
        const tokens = (value as Partial<BrandingSettings> | undefined)?.tokens;
        const isBranding = typeof tokens === 'object' && tokens !== null;

        if (!isBranding) {
            return false;
        }

        // Fill missing placeholders from the defaults, so an older Hub that publishes fewer of them still works.
        BrandingService._settings = {
            ...(value as BrandingSettings),
            tokens: { ...DEFAULT_TOKENS, ...tokens }
        };

        return true;
    }
}

// Compile-time contracts stay after the executable code. Interfaces come before type aliases, and a contract
// follows the contracts that depend on it before A-Z order resumes.

/**
 * The resolved branding the Hub publishes.
 *
 * @remarks
 * The Hub publishes more fields (names, support contact, banner); the extension models only the placeholder map
 * it resolves text with and the assets it may show. Other fields pass through untouched to the webviews.
 */
export interface BrandingSettings {
    /** The asset addresses, relative to the Hub or absolute; absent before the Hub answered. */
    assets?: {
        /** The SVG icon of the G4 extension; read by the G4 extension, passed through here. */
        activityBarIcon?: string;

        /** The favicon address. */
        favicon?: string;

        /** The logo address. */
        logo?: string;

        /** The SVG icon of this extension on the activity bar, its panel tab, and its page header; empty for the built-in icon. */
        testWrightIcon?: string;
    };

    /** The value of every placeholder, keyed by placeholder name without braces, for example engineTm. */
    tokens: Record<string, string>;
}
