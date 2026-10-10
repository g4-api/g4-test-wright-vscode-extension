/*
 * Discovers G4 bots under a bots folder.
 *
 * Every .json, .g4, and .g4bot file is a test; its folder below the bots root is its suite. A file
 * is a bot when it parses as JSON and holds a `stages` array. Tags come from `reference.tags`.
 */
import * as fs from 'node:fs/promises';
import * as path from 'node:path';
import { BotTest, DiscoveryResult, EnvironmentEntry } from '../models/test-wright-models';
import { JsonReader } from '../extensions/json-reader';

// File extensions that hold bots (lower case, with the dot).
const BOT_EXTENSIONS = new Set(['.json', '.g4', '.g4bot']);

// Environment names the engine accepts (its PUT environments/{name} route checks \w+).
// Linear: one character class with a single quantifier, anchored.
const ENVIRONMENT_NAME_PATTERN = /^\w+$/;

// Folders never scanned: tool folders and hidden folders (for example .repositories).
const SKIPPED_FOLDERS = new Set(['node_modules', 'reports']);

/**
 * Scans the file system for bots and environments.
 */
export class BotsDiscoveryService {
    /**
     * Discovers every bot below a folder.
     *
     * @param folderPath - The bots root.
     * @returns The bots sorted by id, the skipped files, or the scan error.
     */
    public static async findTests(folderPath: string): Promise<DiscoveryResult> {
        const result: DiscoveryResult = { folderPath, tests: [], warnings: [] };

        try {
            const stat = await fs.stat(folderPath);

            if (!stat.isDirectory()) {
                return { ...result, error: `'${folderPath}' is not a folder.` };
            }
        } catch {
            return { ...result, error: `The folder '${folderPath}' does not exist.` };
        }

        const files = await BotsDiscoveryService.getBotFiles(folderPath);

        for (const filePath of files) {
            const id = path.relative(folderPath, filePath).split(path.sep).join('/');

            try {
                const bot = await JsonReader.readFile(filePath);

                if (!Array.isArray(bot?.stages)) {
                    result.warnings.push(`${id}: skipped, no 'stages' array (not a bot).`);
                    continue;
                }

                result.tests.push(BotsDiscoveryService.newTest(folderPath, filePath, id, bot));
            } catch (error: any) {
                result.warnings.push(`${id}: skipped, invalid JSON (${error?.message ?? error}).`);
            }
        }

        result.tests.sort((left, right) => left.id.localeCompare(right.id));

        return result;
    }

    /**
     * Lists the environment files of a folder (top level only).
     *
     * @param folderPath - The environments folder.
     * @returns One entry per readable .json file, sorted by name.
     */
    public static async findEnvironments(folderPath: string): Promise<EnvironmentEntry[]> {
        let names: string[];

        try {
            names = await fs.readdir(folderPath);
        } catch {
            return [];
        }

        const environments: EnvironmentEntry[] = [];

        for (const fileName of names) {
            if (path.extname(fileName).toLowerCase() !== '.json') {
                continue;
            }

            const filePath = path.join(folderPath, fileName);
            const name = path.basename(fileName, path.extname(fileName));
            let parameterCount = 0;
            let issue = BotsDiscoveryService.testEnvironmentName(name)
                ? ''
                : 'Rename the file: the engine accepts only letters, digits, and _ in environment names.';

            try {
                const parameters = await JsonReader.readFile(filePath);

                if (parameters && typeof parameters === 'object' && !Array.isArray(parameters)) {
                    parameterCount = Object.keys(parameters).length;
                } else if (issue === '') {
                    issue = 'The file must hold a JSON object of parameter names and values.';
                }
            } catch {
                // An unreadable file is still listed, with the reason, so the user sees it.
                issue = issue || 'The file is not valid JSON.';
            }

            environments.push({ name, path: filePath, parameterCount, issue });
        }

        return environments.sort((left, right) => left.name.localeCompare(right.name));
    }

    /**
     * Whether the engine accepts an environment name: letters, digits, and _ only.
     *
     * @param name - The environment name.
     * @returns True when the engine can store an environment with this name.
     */
    public static testEnvironmentName(name: string): boolean {
        return ENVIRONMENT_NAME_PATTERN.test(name);
    }

    /**
     * Reads one environment file.
     *
     * @param folderPath - The environments folder.
     * @param name - The environment name (file name without .json).
     * @returns The parameters object, or null when the file is missing or invalid.
     */
    public static async readEnvironment(folderPath: string, name: string): Promise<Record<string, any> | null> {
        try {
            const parameters = await JsonReader.readFile(path.join(folderPath, `${name}.json`));

            return parameters && typeof parameters === 'object' ? parameters : null;
        } catch {
            return null;
        }
    }

    // Lists bot files recursively, skipping hidden and tool folders.
    private static async getBotFiles(folderPath: string): Promise<string[]> {
        const files: string[] = [];
        const entries = await fs.readdir(folderPath, { withFileTypes: true });

        for (const entry of entries) {
            const entryPath = path.join(folderPath, entry.name);

            if (entry.isDirectory()) {
                const isSkipped = entry.name.startsWith('.') || SKIPPED_FOLDERS.has(entry.name.toLowerCase());

                if (!isSkipped) {
                    files.push(...await BotsDiscoveryService.getBotFiles(entryPath));
                }

                continue;
            }

            if (entry.isFile() && BOT_EXTENSIONS.has(path.extname(entry.name).toLowerCase())) {
                files.push(entryPath);
            }
        }

        return files;
    }

    // Builds the test entry of one bot file.
    private static newTest(folderPath: string, filePath: string, id: string, bot: any): BotTest {
        const tags = Array.isArray(bot?.reference?.tags)
            ? bot.reference.tags.filter((tag: unknown) => typeof tag === 'string' && tag.trim() !== '').map((tag: string) => tag.trim())
            : [];
        const suite = path.relative(folderPath, path.dirname(filePath)).split(path.sep).join('/');

        return {
            id,
            name: path.basename(filePath, path.extname(filePath)),
            file: id,
            path: filePath,
            suite,
            tags
        };
    }
}
