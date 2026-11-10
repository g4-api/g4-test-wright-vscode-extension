/*
 * G4(TM) Test Wright branding: G4Branding.getText('{testWright}') and data-branding-* attributes.
 *
 * The extension writes the white-label branding the G4 Hub publishes into the page's g4-branding meta tag (the
 * pages allow no inline script) and loads this script in the head, before every page script. Without the tag the
 * built-in G4 defaults apply, so every label keeps the G4 text.
 *
 * Contract:
 * - Text names a product through a placeholder such as {product}, {testWright}, or {engineTm}. Only placeholders
 *   the branding knows are replaced; other braces, identifiers, and routes stay as written.
 * - Markup keeps its G4 text and adds the template in an attribute, so nothing changes before the script runs:
 *   data-branding-text replaces the text and data-branding-title replaces the title (tooltip).
 * - G4Branding.getText(text) resolves a template; G4Branding.getSettings() returns the branding.
 */
(() => {
    'use strict';

    // The placeholder values the Hub publishes when it has no Branding section.
    const DEFAULT_TOKENS = {
        engine: 'G4 Engine',
        engineClient: 'G4 Engine Client',
        engineClientTm: 'G4™ Engine Client',
        engineTm: 'G4™ Engine',
        hub: 'G4 Hub',
        hubTm: 'G4™ Hub',
        mark: 'G4',
        product: 'G4',
        productTm: 'G4™',
        studio: 'G4 Studio',
        studioTm: 'G4™ Studio',
        testWright: 'G4 Test Wright',
        testWrightTm: 'G4™ Test Wright',
        tm: '™'
    };

    // Matches one placeholder such as {engineTm}: a bounded run of word characters between braces, so the match
    // runs in linear time and never spans text outside one pair of braces.
    const TOKEN_PATTERN = /\{(\w{1,64})\}/g;

    // The branding the extension wrote into the page, or the defaults when the tag is missing or malformed.
    const settings = readSettings();

    // Publish the branding API.
    globalThis.G4BrandingSettings = settings;
    globalThis.G4Branding = {
        /**
         * Returns the branding in use.
         *
         * @returns {{ tokens: Record<string, string> }} The branding settings.
         */
        getSettings() {
            return settings;
        },

        /**
         * Replaces every known placeholder in the text with its branded value.
         *
         * @param {string} text - The text to resolve.
         * @returns {string} The resolved text; a value that is not text is returned unchanged.
         */
        getText(text) {
            return getText(text);
        }
    };

    // Brand the page once its markup is parsed; a page already parsed is branded at once.
    const isParsing = document.readyState === 'loading';

    if (isParsing) {
        document.addEventListener('DOMContentLoaded', updateDocument, { once: true });

        return;
    }

    updateDocument();

    /**
     * Replaces every known placeholder in the text with its branded value.
     *
     * @param {string} text - The text to resolve.
     * @returns {string} The resolved text; a value that is not text is returned unchanged.
     */
    function getText(text) {
        // Return a value that is not text unchanged, so callers can pass optional values without a guard.
        if (typeof text !== 'string') {
            return text;
        }

        // Resolve each placeholder from the branding, then the G4 defaults, and keep unknown braces as written.
        return text.replaceAll(TOKEN_PATTERN, (placeholder, tokenName) => {
            return settings.tokens?.[tokenName] ?? DEFAULT_TOKENS[tokenName] ?? placeholder;
        });
    }

    /**
     * Reads the branding from the page's g4-branding meta tag.
     *
     * @returns {{ tokens: Record<string, string> }} The branding, or the defaults when the tag is missing or malformed.
     */
    function readSettings() {
        // Read the tag the extension wrote; a page opened without it keeps the defaults.
        const content = document.querySelector('meta[name="g4-branding"]')?.getAttribute('content');

        if (!content) {
            return { tokens: DEFAULT_TOKENS };
        }

        // Parse the settings, and keep the defaults when the content is not a branding with a token map.
        try {
            const parsedSettings = JSON.parse(content);
            const isBranding = typeof parsedSettings?.tokens === 'object' && parsedSettings.tokens !== null;

            return isBranding ? parsedSettings : { tokens: DEFAULT_TOKENS };
        } catch {
            return { tokens: DEFAULT_TOKENS };
        }
    }

    /**
     * Applies the branding to every element marked with a data-branding-text or data-branding-title attribute.
     */
    function updateDocument() {
        // Replace the text of each element that carries a text template.
        for (const element of document.querySelectorAll('[data-branding-text]')) {
            element.textContent = getText(element.dataset.brandingText);
        }

        // Replace the tooltip of each element that carries a title template.
        for (const element of document.querySelectorAll('[data-branding-title]')) {
            element.setAttribute('title', getText(element.dataset.brandingTitle));
        }
    }
})();
