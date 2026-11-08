/*
 * Shared helpers for the Test Wright extension host: project layout, the G4 project manifest, the
 * engine address, log settings, and small text helpers.
 *
 * RESOURCES:
 * Workspace API: https://code.visualstudio.com/api/references/vscode-api#workspace
 */
import * as fs from 'node:fs';
import * as path from 'node:path';
import * as vscode from 'vscode';
import { JsonReader } from './json-reader';
import { LogSettings } from '../logging/logger-base';

// Characters that cannot appear in a Windows or POSIX file name.
// Linear: one character class with a single quantifier.
const FORBIDDEN_FILE_NAME_PATTERN = /[\\/:*?"<>|]+/g;

/**
 * Static helpers shared by commands, providers, and services.
 */
export class Utilities {
    // Cached manifest snapshot; replaced by updateManifest() so every reader shares one object.
    private static _manifest: any = undefined;

    /**
     * Decodes Base64 text into UTF-8 text.
     *
     * @param base64 - The Base64 text.
     * @returns The decoded text, or an empty string when decoding fails.
     */
    public static convertFromBase64(base64: string): string {
        try {
            return Buffer.from(base64.trim(), 'base64').toString('utf8');
        } catch {
            return '';
        }
    }

    /**
     * Encodes UTF-8 text as Base64.
     *
     * @param text - The text to encode.
     * @returns The Base64 text.
     */
    public static convertToBase64(text: string): string {
        return Buffer.from(text, 'utf8').toString('base64');
    }

    /**
     * Returns the default bots folder: `<project>/bots`.
     *
     * @returns The absolute path, or an empty string when no workspace is open.
     */
    public static getBotsFolder(): string {
        const projectFolder = this.getProjectFolder();

        return projectFolder === '' ? '' : path.join(projectFolder, 'bots');
    }

    /**
     * Returns the G4 engine address from the manifest (`<schema>://<host>:<port>`).
     *
     * @remarks
     * Falls back to `http://localhost:9944`, the sandbox default, when the manifest has no
     * g4Server section.
     *
     * @returns The engine base URL without a trailing slash.
     */
    public static getEngineEndpoint(): string {
        const server = this.getManifest()?.g4Server;
        const isServer = server !== undefined && server !== null && typeof server === 'object';

        if (!isServer || !server.host) {
            return 'http://localhost:9944';
        }

        const schema = server.schema || 'http';
        const port = server.port ? `:${server.port}` : '';

        return `${schema}://${server.host}${port}`;
    }

    /**
     * Returns the default environments folder: `<project>/environments`.
     *
     * @returns The absolute path, or an empty string when no workspace is open.
     */
    public static getEnvironmentsFolder(): string {
        const projectFolder = this.getProjectFolder();

        return projectFolder === '' ? '' : path.join(projectFolder, 'environments');
    }

    /**
     * Resolves the log settings from the manifest, or information-level defaults.
     *
     * @returns The log settings.
     */
    public static getLogSettings(): LogSettings {
        const settings = this.getManifest()?.settings;
        const configuration = settings?.clientLogSettings ?? settings?.clientLogConfiguration;
        const isConfiguration = configuration !== undefined && configuration !== null && configuration.logLevel;

        if (isConfiguration) {
            return {
                logLevel: configuration.logLevel,
                sourceOptions: configuration.sourceOptions ?? { filter: 'include', sources: [] }
            };
        }

        return {
            logLevel: 'information',
            sourceOptions: { filter: 'include', sources: [] }
        };
    }

    /**
     * Returns the cached project manifest, reading it on first access.
     *
     * @returns The parsed manifest, or null when the workspace has none (or it is invalid).
     */
    public static getManifest(): any {
        if (this._manifest === undefined) {
            this._manifest = this.readManifest();
        }

        return this._manifest;
    }

    /**
     * Returns the default plans repository folder: `<project>/.repositories`.
     *
     * @returns The absolute path, or an empty string when no workspace is open.
     */
    public static getPlansFolder(): string {
        const projectFolder = this.getProjectFolder();

        return projectFolder === '' ? '' : path.join(projectFolder, '.repositories');
    }

    /**
     * Returns the G4 project folder: the folder that holds manifest.json.
     *
     * @remarks
     * Follows the G4 Studio convention: when the workspace is the project's `src` folder the
     * manifest is directly under it, otherwise it is under `<workspace>/src`. When neither holds a
     * manifest, the workspace folder itself is the project folder.
     *
     * @returns The absolute path, or an empty string when no workspace is open.
     */
    public static getProjectFolder(): string {
        const workspace = this.getWorkspaceFolder();

        if (workspace === '') {
            return '';
        }

        const nestedFolder = path.join(workspace, 'src');
        const isNestedProject = !fs.existsSync(path.join(workspace, 'manifest.json'))
            && fs.existsSync(path.join(nestedFolder, 'manifest.json'));

        return isNestedProject ? nestedFolder : workspace;
    }

    /**
     * Returns the root folder that holds the run folders: `<reportsFolder>/reports`.
     *
     * @remarks
     * `reportsFolder` comes from the manifest's clientReportSettings and is resolved against the
     * project folder ("." by default), the same place G4 Studio saves its .g4rpt files.
     *
     * @returns The absolute path, or an empty string when no workspace is open.
     */
    public static getReportsFolder(): string {
        const projectFolder = this.getProjectFolder();

        if (projectFolder === '') {
            return '';
        }

        const reportsParent = this.getManifest()?.settings?.clientReportSettings?.reportsFolder || '.';

        return path.resolve(projectFolder, reportsParent, 'reports');
    }

    /**
     * Reads a bundled extension resource as UTF-8 text.
     *
     * @param extensionPath - The extension's install folder.
     * @param resourceName - Path relative to the extension folder.
     * @returns The file text, or an empty string when it cannot be read.
     */
    public static getResource(extensionPath: string, resourceName: string): string {
        try {
            return fs.readFileSync(path.join(extensionPath, resourceName), 'utf8');
        } catch {
            return '';
        }
    }

    /**
     * Returns the first workspace folder path.
     *
     * @returns The absolute path, or an empty string when no workspace is open.
     */
    public static getWorkspaceFolder(): string {
        return vscode.workspace.workspaceFolders?.[0]?.uri.fsPath ?? '';
    }

    /**
     * Creates the folders Test Wright writes to (plans repository and reports) when they are missing.
     *
     * @remarks
     * Runs only in a G4 project (a manifest.json was found), so opening an unrelated workspace never
     * adds folders to it. Folders that already exist are left as they are.
     *
     * @returns The folders that were created, and the errors of folders that could not be created.
     */
    public static newProjectFolders(): { created: string[]; errors: string[] } {
        const result = { created: [] as string[], errors: [] as string[] };

        if (this.getManifest() === null) {
            return result;
        }

        for (const folder of [this.getPlansFolder(), this.getReportsFolder()]) {
            if (folder === '' || fs.existsSync(folder)) {
                continue;
            }

            try {
                fs.mkdirSync(folder, { recursive: true });
                result.created.push(folder);
            } catch (error: any) {
                result.errors.push(`${folder}: ${error?.message ?? error}`);
            }
        }

        return result;
    }

    /**
     * Builds a run folder name from a date: `yyyy-MM-dd-HHmmssfff`, the G4 Studio report naming.
     *
     * @param date - The run start time.
     * @returns The run name.
     */
    public static newRunName(date: Date = new Date()): string {
        const pad = (value: number, length = 2): string => value.toString().padStart(length, '0');

        return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}-` +
            `${pad(date.getHours())}${pad(date.getMinutes())}${pad(date.getSeconds())}` +
            `${pad(date.getMilliseconds(), 3)}`;
    }

    /**
     * Makes text safe to use as a file name.
     *
     * @param text - The candidate name.
     * @returns The name with forbidden characters replaced by an underscore.
     */
    public static newSafeFileName(text: string): string {
        const safeName = text.replace(FORBIDDEN_FILE_NAME_PATTERN, '_').trim();

        return safeName === '' ? 'unnamed' : safeName;
    }

    /**
     * Re-reads the manifest from disk and replaces the cached snapshot.
     *
     * @returns The refreshed manifest, or null.
     */
    public static updateManifest(): any {
        this._manifest = this.readManifest();

        return this._manifest;
    }

    /**
     * Reads and parses `<project>/manifest.json`.
     *
     * @returns The parsed manifest, or null when it is missing or invalid.
     */
    private static readManifest(): any {
        const projectFolder = this.getProjectFolder();

        if (projectFolder === '') {
            return null;
        }

        try {
            return JsonReader.convertFromText(fs.readFileSync(path.join(projectFolder, 'manifest.json'), 'utf8'));
        } catch {
            return null;
        }
    }
}
