/*
 * Builds the HTML of the extension's webview pages (resources.components/<page>/<page>.html).
 *
 * A page declares its components with a `g4-components` meta tag (filled by WebviewComponents) and
 * its own scripts with a `g4-page-modules` meta tag: module names under `<page>/modules/`, loaded
 * in the listed order after the components. Placeholders:
 *
 * - {{$ csp.source }}           webview.cspSource, for the Content-Security-Policy.
 * - {{$ component.style.uri }}   the page stylesheet (<page>.css).
 * - {{$ component.script.uri }}  the page script (<page>.js), loaded last.
 * - {{$ page.modules }}          the module script tags.
 * - {{$ fonts.uri }}             the resources.fonts folder.
 * - {{$ page.data }}             HTML-escaped JSON the page reads from #g4-data (optional).
 *
 * RESOURCES:
 * Content Security Policy in webviews: https://code.visualstudio.com/api/extension-guides/webview#content-security-policy
 */
import * as path from 'node:path';
import * as vscode from 'vscode';
import { Utilities } from './utilities';
import { WebviewComponents } from './webview-components';

// Reads the module names a page declares: <meta name="g4-page-modules" content="a b c">.
// Linear: literal text, then one negated character class with a single quantifier.
const PAGE_MODULES_PATTERN = /<meta\s+name="g4-page-modules"\s+content="([^"]*)"/i;

// Accepted module names: lowercase words joined by hyphens.
const MODULE_NAME_PATTERN = /^[a-z0-9-]+$/;

/**
 * Page HTML builder shared by every Test Wright webview.
 */
export class WebviewPages {
    /**
     * The Test Wright icon for a panel's editor tab.
     *
     * @remarks
     * A tab draws the icon as an image, so `currentColor` would render black; the light and dark
     * copies carry the default VS Code icon colors. The Activity Bar keeps the currentColor icon,
     * which VS Code recolors itself.
     *
     * @param context - The extension context.
     * @returns The light and dark icon URIs.
     */
    public static getPanelIcon(context: vscode.ExtensionContext): { light: vscode.Uri; dark: vscode.Uri } {
        return {
            light: vscode.Uri.joinPath(context.extensionUri, 'resources.assets', 'g4-test-wright-mark-light.svg'),
            dark: vscode.Uri.joinPath(context.extensionUri, 'resources.assets', 'g4-test-wright-mark-dark.svg')
        };
    }

    /**
     * Folders a page may load files from.
     *
     * @param context - The extension context.
     * @returns The resource roots.
     */
    public static getResourceRoots(context: vscode.ExtensionContext): vscode.Uri[] {
        return [
            vscode.Uri.joinPath(context.extensionUri, 'resources.components'),
            vscode.Uri.joinPath(context.extensionUri, 'resources.fonts'),
            vscode.Uri.joinPath(context.extensionUri, 'resources.assets')
        ];
    }

    /**
     * Escapes text for an HTML text context (textarea content).
     *
     * @param text - Raw text.
     * @returns The escaped text.
     */
    public static getEscapedHtml(text: string): string {
        return text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
    }

    /**
     * Builds a page's HTML.
     *
     * @param webview - The hosting webview (URI conversion and CSP source).
     * @param context - The extension context.
     * @param pageName - Page folder and file base name under resources.components.
     * @param data - Optional data injected into {{$ page.data }} as JSON.
     * @returns The complete HTML.
     */
    public static newPageHtml(webview: vscode.Webview, context: vscode.ExtensionContext, pageName: string, data?: unknown): string {
        const componentsRoot = vscode.Uri.joinPath(context.extensionUri, 'resources.components');
        const toUri = (filePath: string): string => webview.asWebviewUri(vscode.Uri.file(filePath)).toString();
        const pageFolder = path.join(componentsRoot.fsPath, pageName);
        const pageHtml = Utilities.getResource(context.extensionPath, path.join('resources.components', pageName, `${pageName}.html`));

        // Components first, so page data is never searched for component placeholders.
        const html = WebviewComponents.setComponentHtml({ html: pageHtml, rootPath: componentsRoot.fsPath, toUri });
        const moduleNames = (PAGE_MODULES_PATTERN.exec(html)?.[1] ?? '')
            .trim()
            .split(/\s+/)
            .filter((name) => name !== '');
        const modules = moduleNames
            .map((name) => {
                if (!MODULE_NAME_PATTERN.test(name)) {
                    throw new Error(`'${name}' is not a page module name.`);
                }

                return `<script src="${toUri(path.join(pageFolder, 'modules', `${name}.js`))}"></script>`;
            })
            .join('\n');
        const dataText = data === undefined ? '' : WebviewPages.getEscapedHtml(JSON.stringify(data));

        // Replacer functions keep any `$` in the inserted text from being read as a pattern.
        return html
            .replace(/\{\{\$ csp\.source \}\}/g, () => webview.cspSource)
            .replace('{{$ component.style.uri }}', () => toUri(path.join(pageFolder, `${pageName}.css`)))
            .replace('{{$ component.script.uri }}', () => toUri(path.join(pageFolder, `${pageName}.js`)))
            .replace('{{$ page.modules }}', () => modules)
            .replace(/\{\{\$ fonts\.uri \}\}/g, () => webview.asWebviewUri(vscode.Uri.joinPath(context.extensionUri, 'resources.fonts')).toString())
            .replace('{{$ page.data }}', () => dataText);
    }
}
