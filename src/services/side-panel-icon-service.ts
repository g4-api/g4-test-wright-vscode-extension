/*
 * The side-panel icon: the Test Wright icon on the activity bar, its views, its panel tab, and its page header.
 *
 * VS Code reads the activity bar icon from the file package.json names, once, when it starts; no API changes it while
 * the window runs. The extension therefore copies the chosen icon over its installed icon files, and VS Code shows it
 * from the next start. The icon is chosen in this order: the local g4TestWright.sidePanelIcon setting, then the
 * TestWrightIcon the G4 Hub publishes in its branding, then the built-in icon kept untouched under
 * resources.assets/defaults.
 *
 * RESOURCES:
 * Activity bar icons: https://code.visualstudio.com/api/references/contribution-points#contributes.viewsContainers
 */
import * as fs from 'node:fs/promises';
import * as os from 'node:os';
import * as path from 'node:path';
import type * as vscode from 'vscode';

/** The VS Code setting that holds the path of a local SVG file to use as the side-panel icon. */
export const SIDE_PANEL_ICON_SETTING = 'g4TestWright.sidePanelIcon';

// The folder of the installed icon files, relative to the install folder.
const ASSETS_FOLDER = 'resources.assets';

// The folder of the untouched built-in icons, relative to the install folder.
const DEFAULTS_FOLDER = path.join('resources.assets', 'defaults');

// The global state key that keeps the last icon the Hub published, so a start without the Hub can still apply it.
const HUB_ICON_STATE_KEY = 'g4TestWright.sidePanelIcon.hub';

// The icon files this service writes. The activity bar and the views keep currentColor, which VS Code tints to the
// theme; the panel tab draws the icon as an image, so its light and dark copies carry the VS Code icon colors.
const ICON_FILES: readonly IconFile[] = [
    { color: undefined, name: 'g4-test-wright-mark.svg' },
    { color: '#C5C5C5', name: 'g4-test-wright-mark-dark.svg' },
    { color: '#424242', name: 'g4-test-wright-mark-light.svg' }
];

// The largest icon accepted; an activity bar icon is a few kilobytes, so anything larger is not an icon.
const MAXIMUM_ICON_BYTES = 256 * 1024;

// How long the Hub icon request may take before the kept icon is used.
const REQUEST_TIMEOUT_MILLISECONDS = 5000;

// Matches the opening of the root svg element. Linear: a literal followed by one character class.
const SVG_START_PATTERN = /^<svg[\s>]/i;

// Matches the slashes that end a base URL, so the icon path is joined with exactly one slash. Linear: one literal
// with a single quantifier, anchored at the end.
const TRAILING_SLASHES_PATTERN = /\/+$/;

// Matches an XML prolog such as <?xml version="1.0"?>. Linear: one bounded character class between literals.
const XML_PROLOG_PATTERN = /^<\?xml[^>]{0,256}\?>/;

/**
 * Chooses the side-panel icon and copies it over the installed icon files.
 *
 * @remarks
 * Static, because the installed icon files are one value for the whole extension host. Every input comes through the
 * options, so the choice does not depend on hidden state.
 */
export class SidePanelIconService {
    /**
     * Tests whether a text is an SVG document.
     *
     * @remarks
     * Accepts a byte order mark, leading white space, and an XML prolog before the root svg element, and requires the
     * document to end with the closing svg tag. The check refuses other files placed by mistake, such as a PNG or an
     * HTML page; VS Code and the page header draw the icon as an image, so no script inside it runs.
     *
     * @param text - The candidate text.
     * @returns True when the text is an SVG document.
     */
    public static testSvgIcon(text: string): boolean {
        // Drop a byte order mark and the white space before the markup.
        const unmarkedText = text.charCodeAt(0) === 0xFEFF ? text.slice(1) : text;
        let markup = unmarkedText.trimStart();

        // Step over an XML prolog, which may precede the root element.
        const prolog = XML_PROLOG_PATTERN.exec(markup);

        if (prolog !== null) {
            markup = markup.slice(prolog[0].length).trimStart();
        }

        // Require the root svg element at the start and its closing tag at the end.
        const isClosed = markup.trimEnd().toLowerCase().endsWith('</svg>');

        return SVG_START_PATTERN.test(markup) && isClosed;
    }

    /**
     * Chooses the side-panel icon and copies it over the installed icon files that differ.
     *
     * @remarks
     * Never throws. A choice that cannot be read, such as a missing local file, an invalid SVG, or an unreachable Hub
     * without a kept icon, keeps the installed icons and writes one warning, so a mistake never blanks the icon. The
     * activity bar shows the new icon from the next VS Code start; panels opened later use it at once.
     *
     * @param options - The choices and the places to read and write.
     * @returns True when at least one installed icon file was replaced.
     */
    public static async updateAsync(options: UpdateSidePanelIconOptions): Promise<boolean> {
        // Pick the icon by precedence: the local setting, then the Hub branding, then the built-in icons.
        const configuredPath = options.configuredPath.trim();
        const hubIcon = options.hubIcon?.trim() ?? '';
        let icons: Map<string, string> | undefined;

        if (configuredPath !== '') {
            icons = SidePanelIconService.newIconFiles(await SidePanelIconService.readLocalIconAsync(configuredPath, options.logger));
        } else if (hubIcon === '') {
            icons = await SidePanelIconService.readDefaultIconsAsync(options);
        } else {
            icons = SidePanelIconService.newIconFiles(await SidePanelIconService.readHubIconAsync({ ...options, hubIcon }));
        }

        // Keep the installed icons when the chosen one could not be read.
        if (icons === undefined) {
            return false;
        }

        // Replace each installed file only when its content differs, so an unchanged choice writes nothing.
        let isUpdated = false;

        for (const [name, icon] of icons) {
            const iconPath = path.join(options.extensionPath, ASSETS_FOLDER, name);
            const installedIcon = await fs.readFile(iconPath, 'utf8').catch(() => '');

            if (installedIcon === icon) {
                continue;
            }

            try {
                await fs.writeFile(iconPath, icon, 'utf8');
                isUpdated = true;
            } catch (error) {
                options.logger.warning(`The side-panel icon could not be written to ${iconPath}: ${resolveErrorMessage(error)}`);

                return isUpdated;
            }
        }

        // Tell the user when the change shows, because VS Code reads the activity bar icon only at startup.
        if (isUpdated) {
            options.logger.information('The side-panel icon was updated; it shows from the next VS Code start.');
        }

        return isUpdated;
    }

    /**
     * Converts one chosen icon into the content of each installed icon file.
     *
     * @param icon - The chosen SVG document; undefined when it could not be read.
     * @returns The content by file name, or undefined when there is no icon.
     */
    private static newIconFiles(icon: string | undefined): Map<string, string> | undefined {
        if (icon === undefined) {
            return undefined;
        }

        // Keep currentColor where VS Code tints the icon, and fix the color where it draws the icon as an image.
        return new Map(ICON_FILES.map((file) => [file.name, file.color === undefined ? icon : icon.replaceAll('currentColor', file.color)]));
    }

    /**
     * Reads the built-in icons and forgets the icon the Hub published before.
     *
     * @param options - The extension path, the global state, and the logger.
     * @returns The built-in content by file name, or undefined when the extension files are incomplete.
     */
    private static async readDefaultIconsAsync(options: UpdateSidePanelIconOptions): Promise<Map<string, string> | undefined> {
        // Forget a Hub icon that the Hub no longer publishes, so a later outage cannot bring it back.
        if (options.globalState.get<unknown>(HUB_ICON_STATE_KEY) !== undefined) {
            await options.globalState.update(HUB_ICON_STATE_KEY, undefined);
        }

        // Read each untouched built-in icon; a missing copy keeps the installed icons.
        const icons = new Map<string, string>();

        for (const file of ICON_FILES) {
            const defaultPath = path.join(options.extensionPath, DEFAULTS_FOLDER, file.name);

            try {
                icons.set(file.name, await fs.readFile(defaultPath, 'utf8'));
            } catch (error) {
                options.logger.warning(`The built-in side-panel icon could not be read from ${defaultPath}: ${resolveErrorMessage(error)}`);

                return undefined;
            }
        }

        return icons;
    }

    /**
     * Reads the icon the Hub publishes, or the copy kept from the last time the Hub answered.
     *
     * @remarks
     * Without a Hub base URL, as at startup before the Hub answered, only the kept copy is used, and only when it was
     * read for the same icon the branding names. A Hub that does not answer also falls back to the kept copy.
     *
     * @param options - The Hub icon, the Hub base URL, the global state, and the logger.
     * @returns The icon, or undefined when neither the Hub nor the kept copy provides a valid one.
     */
    private static async readHubIconAsync(options: UpdateSidePanelIconOptions & { hubIcon: string; }): Promise<string | undefined> {
        // Find the copy kept for this icon, the fallback for every failure below.
        const keptIcon = options.globalState.get<KeptHubIcon>(HUB_ICON_STATE_KEY);
        const keptSvg = keptIcon?.source === options.hubIcon ? keptIcon.svg : undefined;

        if (!options.hubBaseUrl) {
            return keptSvg;
        }

        // Download the icon; a path is resolved against the Hub, and an absolute URL is used as written.
        let iconText: string;

        try {
            const iconUrl = new URL(options.hubIcon, `${options.hubBaseUrl.replace(TRAILING_SLASHES_PATTERN, '')}/`);
            const response = await fetch(iconUrl, { signal: AbortSignal.timeout(REQUEST_TIMEOUT_MILLISECONDS) });

            if (!response.ok) {
                options.logger.warning(`The Hub side-panel icon ${iconUrl.href} answered ${response.status}; the current icon is kept.`);

                return keptSvg;
            }

            // Refuse a large answer before decoding it.
            const iconBytes = Buffer.from(await response.arrayBuffer());

            if (iconBytes.length > MAXIMUM_ICON_BYTES) {
                options.logger.warning(`The Hub side-panel icon ${iconUrl.href} is larger than 256 KB; the current icon is kept.`);

                return keptSvg;
            }

            iconText = iconBytes.toString('utf8');
        } catch (error) {
            options.logger.warning(`The Hub side-panel icon ${options.hubIcon} could not be read: ${resolveErrorMessage(error)}`);

            return keptSvg;
        }

        // Refuse a file that is not an SVG document, such as a PNG or an error page.
        if (!SidePanelIconService.testSvgIcon(iconText)) {
            options.logger.warning(`The Hub side-panel icon ${options.hubIcon} is not an SVG file; the current icon is kept.`);

            return keptSvg;
        }

        // Keep the icon for starts without the Hub, writing only when it changed.
        if (keptIcon?.source !== options.hubIcon || keptIcon.svg !== iconText) {
            await options.globalState.update(HUB_ICON_STATE_KEY, { source: options.hubIcon, svg: iconText });
        }

        return iconText;
    }

    /**
     * Reads the icon file the local setting names.
     *
     * @param configuredPath - The path from the setting, absolute or starting with ~ for the home folder.
     * @param logger - Receives the reason when the file cannot be used.
     * @returns The icon, or undefined when the path is relative or the file is missing, too large, or not an SVG.
     */
    private static async readLocalIconAsync(configuredPath: string, logger: SidePanelIconLogger): Promise<string | undefined> {
        // Expand the home folder, so the setting can be shared between machines with different user names.
        const isHomePath = configuredPath === '~' || configuredPath.startsWith('~/') || configuredPath.startsWith('~\\');
        const iconPath = isHomePath ? path.join(os.homedir(), configuredPath.slice(1)) : configuredPath;

        // Refuse a relative path: the setting applies to every workspace, so there is no folder to resolve it against.
        if (!path.isAbsolute(iconPath)) {
            logger.warning(`${SIDE_PANEL_ICON_SETTING} must be an absolute path to an .svg file; "${configuredPath}" is relative.`);

            return undefined;
        }

        // Read the file, refusing a large file before reading it.
        let iconText: string;

        try {
            const iconStatistics = await fs.stat(iconPath);

            if (iconStatistics.size > MAXIMUM_ICON_BYTES) {
                logger.warning(`The side-panel icon ${iconPath} is larger than 256 KB; the current icon is kept.`);

                return undefined;
            }

            iconText = await fs.readFile(iconPath, 'utf8');
        } catch (error) {
            logger.warning(`The side-panel icon ${iconPath} could not be read: ${resolveErrorMessage(error)}`);

            return undefined;
        }

        // Refuse a file that is not an SVG document.
        if (!SidePanelIconService.testSvgIcon(iconText)) {
            logger.warning(`The side-panel icon ${iconPath} is not an SVG file; the current icon is kept.`);

            return undefined;
        }

        return iconText;
    }
}

/**
 * Resolves a readable message from a caught value.
 *
 * @param error - The caught value.
 * @returns The error message, the string itself, or a JSON form of any other value.
 */
function resolveErrorMessage(error: unknown): string {
    if (error instanceof Error) {
        return error.message;
    }

    if (typeof error === 'string') {
        return error;
    }

    // Any other thrown value gets a readable JSON form instead of default object stringification.
    try {
        return JSON.stringify(error) ?? 'Unknown error';
    } catch {
        return 'Unknown error';
    }
}

// Compile-time contracts stay after the executable code. Interfaces come before type aliases, and a contract
// follows the contracts that depend on it before A-Z order resumes.

/**
 * One installed icon file and the color it is written with.
 */
interface IconFile {
    /** The fixed color that replaces currentColor; undefined keeps currentColor for VS Code to tint. */
    color: string | undefined;

    /** The file name under resources.assets and resources.assets/defaults. */
    name: string;
}

/**
 * The Hub icon kept in the global state.
 */
interface KeptHubIcon {
    /** The TestWrightIcon value the icon was read for, so a changed value never reuses an older icon. */
    source: string;

    /** The SVG document. */
    svg: string;
}

/**
 * The choices and places the side-panel icon update reads and writes.
 */
export interface UpdateSidePanelIconOptions {
    /** The value of the g4TestWright.sidePanelIcon setting; empty when the user chose no local icon. */
    configuredPath: string;

    /** The folder the extension is installed in, which holds the icon files and the built-in copies. */
    extensionPath: string;

    /** The extension's global state, which keeps the last icon the Hub published. */
    globalState: vscode.Memento;

    /** The Hub base URL, for example http://localhost:9944; absent before the Hub answered. */
    hubBaseUrl?: string;

    /** The TestWrightIcon of the Hub branding: a path served by the Hub or an absolute URL; empty or absent for none. */
    hubIcon?: string;

    /** Receives the outcome and the reason a choice could not be used. */
    logger: SidePanelIconLogger;
}

/**
 * The part of the extension logger the icon update writes to.
 *
 * @remarks
 * Only the two levels the update uses, so callers can pass a small stand-in instead of the extension logger.
 */
interface SidePanelIconLogger {
    /** Writes an outcome the user may want to know, such as a new icon waiting for the next start. */
    information(message: string): void;

    /** Writes the reason a chosen icon could not be used. */
    warning(message: string): void;
}
