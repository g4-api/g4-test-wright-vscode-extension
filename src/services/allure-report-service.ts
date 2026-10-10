/*
 * Generates and serves Allure 3 reports, with no Java required.
 *
 * Generation runs the bundled Allure 3 CLI (node_modules/allure/cli.js) on VS Code's own Node
 * runtime (ELECTRON_RUN_AS_NODE), so users need neither Java nor a separate Node install. The
 * generated folder is served from a local static server and shown in a VS Code panel or the
 * external browser.
 *
 * RESOURCES:
 * Allure 3 CLI: https://allurereport.org/docs/v3/
 * Webview iframes and localhost: https://code.visualstudio.com/api/advanced-topics/remote-extensions#option-2-use-a-port-mapping
 */
import * as childProcess from 'node:child_process';
import * as fs from 'node:fs/promises';
import * as http from 'node:http';
import * as path from 'node:path';
import * as vscode from 'vscode';
import { ALLURE_CATEGORIES, ALLURE_FOLDER_PREFIX, ALLURE_MERGED_FOLDER, AllureConverter } from './allure-converter';
import { WebviewPages } from '../extensions/webview-pages';
import { Logger } from '../logging/logger';

// Results folder inside a run folder, from before the allure-<run> layout (read only).
const LEGACY_RESULTS_FOLDER = 'allure-results';

// Content types for the files an Allure report holds.
const CONTENT_TYPES: Record<string, string> = {
    '.css': 'text/css; charset=utf-8',
    '.csv': 'text/csv; charset=utf-8',
    '.gif': 'image/gif',
    '.html': 'text/html; charset=utf-8',
    '.ico': 'image/x-icon',
    '.jpg': 'image/jpeg',
    '.js': 'text/javascript; charset=utf-8',
    '.json': 'application/json; charset=utf-8',
    '.mjs': 'text/javascript; charset=utf-8',
    '.png': 'image/png',
    '.svg': 'image/svg+xml',
    '.txt': 'text/plain; charset=utf-8',
    '.webm': 'video/webm',
    '.woff': 'font/woff',
    '.woff2': 'font/woff2'
};

// Upper bound for one report generation.
const GENERATE_TIMEOUT_MILLISECONDS = 5 * 60 * 1000;

/**
 * Generates Allure reports and opens them.
 */
export class AllureReportService implements vscode.Disposable {
    // Static servers by served folder, reused when the same report opens again.
    private readonly _servers = new Map<string, { server: http.Server; url: string }>();

    // Allure panels by report folder, revealed instead of duplicated.
    private readonly _panels = new Map<string, vscode.WebviewPanel>();

    // Report folders being generated right now.
    private readonly _generatingFolders = new Set<string>();

    // The extension context (install path for the Allure CLI).
    private readonly _context: vscode.ExtensionContext;

    // Named logger.
    private readonly _logger: Logger;

    /**
     * Creates the service.
     *
     * @param context - The extension context.
     * @param logger - Parent logger.
     */
    constructor(context: vscode.ExtensionContext, logger: Logger) {
        this._context = context;
        this._logger = logger.newLogger('G4.TestWright.AllureReport');
    }

    /**
     * Stops every static server and closes the report panels.
     */
    public dispose(): void {
        this._servers.forEach(({ server }) => server.close());
        this._servers.clear();
        this._panels.forEach((panel) => panel.dispose());
        this._panels.clear();
    }

    /**
     * Finds the Allure results folders a selection covers.
     *
     * @remarks
     * Accepted selections:
     * - a results folder (holds *-result.json files);
     * - a run folder (holds run.json): its `allure-<run>/results`;
     * - a run's `allure-<run>` folder: its `results`;
     * - any other folder (the reports root): searched two levels down for `allure-<run>/results`,
     *   so selecting the reports root merges every run into one report.
     * Runs saved before the allure-<run> layout keep their results in `<run>/allure-results`;
     * those are still found.
     *
     * @param folderPath - The selected folder.
     * @returns The results folders, sorted by path.
     */
    public static async findResultsFolders(folderPath: string): Promise<string[]> {
        if (await AllureReportService.testResultsFolder(folderPath)) {
            return [folderPath];
        }

        const ownFolder = await AllureReportService.findOwnResultsFolder(folderPath);

        if (ownFolder !== null) {
            return [ownFolder];
        }

        const folders: string[] = [];
        const visit = async (current: string, depth: number): Promise<void> => {
            let entries;

            try {
                entries = await fs.readdir(current, { withFileTypes: true });
            } catch {
                return;
            }

            for (const entry of entries.filter((candidate) => candidate.isDirectory())) {
                const entryPath = path.join(current, entry.name);
                const isAllureFolder = entry.name.startsWith(ALLURE_FOLDER_PREFIX);

                if (!isAllureFolder) {
                    // A run folder's legacy results are used only when it has no allure-<run> folder.
                    const legacyFolder = path.join(entryPath, LEGACY_RESULTS_FOLDER);
                    const hasCurrentFolder = await AllureReportService.testResultsFolder(AllureConverter.getResultsFolder(entryPath));

                    if (!hasCurrentFolder && await AllureReportService.testResultsFolder(legacyFolder)) {
                        folders.push(legacyFolder);
                    } else if (depth < 2) {
                        await visit(entryPath, depth + 1);
                    }

                    continue;
                }

                const resultsFolder = path.join(entryPath, 'results');

                if (await AllureReportService.testResultsFolder(resultsFolder)) {
                    folders.push(resultsFolder);
                }
            }
        };

        await visit(folderPath, 0);

        return folders.sort();
    }

    /**
     * Returns the report folder for a set of results folders.
     *
     * @param folderPath - The selected folder.
     * @param resultsFolders - The results folders found for it.
     * @returns `allure-<run>/report` for one run; `<selected>/allure-merged` for several.
     */
    public static getReportFolder(folderPath: string, resultsFolders: string[]): string {
        if (resultsFolders.length !== 1) {
            return path.join(folderPath, ALLURE_MERGED_FOLDER);
        }

        const resultsFolder = resultsFolders[0];

        // Legacy layout: <run>/allure-results gets its report in the run's allure-<run> folder.
        return path.basename(resultsFolder) === LEGACY_RESULTS_FOLDER
            ? AllureConverter.getReportFolder(path.dirname(resultsFolder))
            : path.join(path.dirname(resultsFolder), 'report');
    }

    /**
     * Returns the run name a single results folder belongs to.
     *
     * @param resultsFolder - `allure-<run>/results`, or a legacy `<run>/allure-results`.
     * @returns The run name.
     */
    public static getRunName(resultsFolder: string): string {
        const parentName = path.basename(path.dirname(resultsFolder));

        return path.basename(resultsFolder) === LEGACY_RESULTS_FOLDER || !parentName.startsWith(ALLURE_FOLDER_PREFIX)
            ? parentName
            : parentName.slice(ALLURE_FOLDER_PREFIX.length);
    }

    // The results folder of a run folder or of a run's allure-<run> folder, or null.
    private static async findOwnResultsFolder(folderPath: string): Promise<string | null> {
        const candidates = path.basename(folderPath).startsWith(ALLURE_FOLDER_PREFIX)
            ? [path.join(folderPath, 'results')]
            : [AllureConverter.getResultsFolder(folderPath), path.join(folderPath, LEGACY_RESULTS_FOLDER)];

        for (const candidate of candidates) {
            if (await AllureReportService.testResultsFolder(candidate)) {
                return candidate;
            }
        }

        return null;
    }

    /**
     * Generates a report from a selection and opens it.
     *
     * @param folderPath - A results folder, a run folder, or the reports root.
     * @param isBrowser - Open in the external browser instead of a VS Code panel.
     * @param log - Console sink for progress lines.
     * @returns The served URL, or the error.
     */
    public async openReport(folderPath: string, isBrowser: boolean, log: (text: string, kind?: string) => void): Promise<{ url?: string; error?: string }> {
        let resultsFolders = await AllureReportService.findResultsFolders(folderPath);

        // A run made with Collect off has no results yet: convert it, as Convert to Allure would.
        if (resultsFolders.length === 0 && await AllureReportService.testRunFolder(folderPath)) {
            log('The run has no Allure results yet; converting it...', 'muted');
            await AllureConverter.convertRun(folderPath);
            resultsFolders = await AllureReportService.findResultsFolders(folderPath);
        }

        if (resultsFolders.length === 0) {
            return { error: `No Allure results under '${folderPath}'. Turn Collect on and run, or convert a run first.` };
        }

        // One run writes allure-<run>/report; a merge writes allure-merged under the selected folder.
        const outputFolder = AllureReportService.getReportFolder(folderPath, resultsFolders);
        const reportName = resultsFolders.length === 1
            ? `G4 Run ${AllureReportService.getRunName(resultsFolders[0])}`
            : `G4 Runs (${resultsFolders.length})`;

        // Two generations into one folder would replace each other's files mid-write.
        if (this._generatingFolders.has(outputFolder)) {
            return { error: 'This Allure report is already being generated. Wait for it to open.' };
        }

        log(`Generating Allure report from ${resultsFolders.length} results folder(s)...`, 'info');
        this._generatingFolders.add(outputFolder);

        let error: string | null;

        try {
            error = await this.generateReport(resultsFolders, outputFolder, reportName);
        } finally {
            this._generatingFolders.delete(outputFolder);
        }

        if (error !== null) {
            return { error };
        }

        const url = await this.startServer(outputFolder);

        if (isBrowser) {
            await vscode.env.openExternal(await vscode.env.asExternalUri(vscode.Uri.parse(url)));
        } else {
            await this.showPanel(outputFolder, url, reportName);
        }

        return { url };
    }

    /**
     * Runs the Allure 3 CLI `generate` command.
     *
     * @param resultsFolders - Results folders to read.
     * @param outputFolder - Report folder to write (replaced).
     * @param reportName - Report title.
     * @returns Null on success, or the error text.
     */
    public async generateReport(resultsFolders: string[], outputFolder: string, reportName: string): Promise<string | null> {
        const cliPath = path.join(this._context.extensionPath, 'node_modules', 'allure', 'cli.js');
        const configPath = await this.writeConfig();
        const args = [cliPath, 'generate', ...resultsFolders, '--output', outputFolder, '--name', reportName, '--config', configPath];

        return new Promise((resolve) => {
            const output: string[] = [];
            const child = childProcess.spawn(process.execPath, args, {
                cwd: path.dirname(outputFolder),
                env: { ...process.env, ELECTRON_RUN_AS_NODE: '1', NO_COLOR: '1' },
                windowsHide: true
            });
            const timer = setTimeout(() => child.kill(), GENERATE_TIMEOUT_MILLISECONDS);

            child.stdout.on('data', (chunk) => output.push(`${chunk}`));
            child.stderr.on('data', (chunk) => output.push(`${chunk}`));

            child.on('error', (error) => {
                clearTimeout(timer);
                resolve(`The Allure CLI could not start: ${error.message}`);
            });

            child.on('close', (code) => {
                clearTimeout(timer);

                const text = output.join('').trim();

                if (text !== '') {
                    this._logger.information(`allure generate: ${text}`);
                }

                resolve(code === 0 ? null : `Allure generate exited with code ${code}: ${text.split('\n').slice(-3).join(' ')}`);
            });
        });
    }

    // Shows (or reveals) a VS Code panel that frames the served report.
    private async showPanel(outputFolder: string, url: string, title: string): Promise<void> {
        const existing = this._panels.get(outputFolder);
        const externalUrl = (await vscode.env.asExternalUri(vscode.Uri.parse(url))).toString(true);

        if (existing !== undefined) {
            existing.webview.html = AllureReportService.newFrameHtml(externalUrl, title);
            existing.reveal();

            return;
        }

        const panel = vscode.window.createWebviewPanel('g4TestWright.allure', title, vscode.ViewColumn.Active, {
            enableScripts: true,
            retainContextWhenHidden: true
        });

        panel.iconPath = WebviewPages.getPanelIcon(this._context);
        panel.webview.html = AllureReportService.newFrameHtml(externalUrl, title);
        panel.onDidDispose(() => this._panels.delete(outputFolder));
        this._panels.set(outputFolder, panel);
    }

    // Serves a folder on 127.0.0.1 (random port); reuses the server for the same folder.
    private startServer(rootFolder: string): Promise<string> {
        const existing = this._servers.get(rootFolder);

        if (existing !== undefined) {
            return Promise.resolve(existing.url);
        }

        const root = path.resolve(rootFolder);
        const server = http.createServer(async (request, response) => {
            try {
                const requestPath = decodeURIComponent(new URL(request.url ?? '/', 'http://localhost').pathname);
                let filePath = path.resolve(root, `.${requestPath}`);

                // Never serve anything outside the report folder.
                if (filePath !== root && !filePath.startsWith(root + path.sep)) {
                    response.writeHead(403).end();

                    return;
                }

                if ((await fs.stat(filePath)).isDirectory()) {
                    filePath = path.join(filePath, 'index.html');
                }

                const content = await fs.readFile(filePath);

                response.writeHead(200, {
                    'Content-Type': CONTENT_TYPES[path.extname(filePath).toLowerCase()] ?? 'application/octet-stream',
                    'Cache-Control': 'no-store'
                });
                response.end(content);
            } catch {
                response.writeHead(404).end();
            }
        });

        return new Promise((resolve, reject) => {
            server.once('error', reject);
            server.listen(0, '127.0.0.1', () => {
                const address = server.address();
                const port = typeof address === 'object' && address !== null ? address.port : 0;
                const url = `http://127.0.0.1:${port}/`;

                this._servers.set(rootFolder, { server, url });
                resolve(url);
            });
        });
    }

    // Page that fills the panel with the report iframe.
    private static newFrameHtml(url: string, title: string): string {
        const origin = new URL(url).origin;

        return `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta http-equiv="Content-Security-Policy" content="default-src 'none'; frame-src ${origin}; style-src 'unsafe-inline';">
    <title>${title}</title>
    <style>
        html, body, iframe { margin: 0; padding: 0; width: 100%; height: 100%; border: 0; overflow: hidden; }
    </style>
</head>
<body>
    <iframe src="${url}" title="${title}" data-test-id="allure-report-frame"></iframe>
</body>
</html>`;
    }

    // True when a folder holds at least one Allure result file.
    private static async testResultsFolder(folderPath: string): Promise<boolean> {
        try {
            return (await fs.readdir(folderPath)).some((name) => name.endsWith('-result.json'));
        } catch {
            return false;
        }
    }

    // True when a folder is a Test Wright run folder (holds run.json).
    private static async testRunFolder(folderPath: string): Promise<boolean> {
        try {
            return (await fs.stat(path.join(folderPath, 'run.json'))).isFile();
        } catch {
            return false;
        }
    }

    // Writes the Allure 3 config (Test Wright's categories) to the extension storage; returns its path.
    // Allure 3's report reads categories from its config, not from categories.json in the results.
    private async writeConfig(): Promise<string> {
        const folder = this._context.globalStorageUri.fsPath;
        const configPath = path.join(folder, 'allurerc.json');

        await fs.mkdir(folder, { recursive: true });
        await fs.writeFile(configPath, JSON.stringify({ categories: ALLURE_CATEGORIES }, null, 2), 'utf8');

        return configPath;
    }
}
