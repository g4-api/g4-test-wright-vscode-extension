/*
 * Data tables of plan items: the columns a bot reads, the rows of a bot's own data source, the
 * one-row data source sent with each iteration, and the data files of the iterations editor.
 *
 * Columns are the {{$ columns.Name }} placeholders in the bot's rules, matched the way the engine
 * matches them: case-insensitive, one whitespace on each side, and a word name. The engine resolves
 * columns only inside rules, so only the stages are scanned. A bot without placeholders is static:
 * it runs unchanged in every iteration.
 *
 * Free of the vscode module, so the service stays testable under plain Node.
 */
import * as fs from 'node:fs/promises';
import * as path from 'node:path';

import { JsonReader } from '../extensions/json-reader';

import {
    BotDataDescription,
    DataFile
} from '../models/test-wright-models';

// The UTF-8 byte order mark as decoded text; some editors write it before the data.
const BYTE_ORDER_MARK = String.fromCodePoint(0xfeff);

// Type marker of a data file written by the iterations editor.
const DATA_FILE_TYPE = 'g4-test-wright-data';

// The only data source type the engine reads.
const JSON_DATA_SOURCE_TYPE = 'Json';

// A column placeholder, as the engine finds it: '{{$', one whitespace, 'columns.', a word name,
// one whitespace, '}}'. Linear: literal text, single whitespace tokens, and one bounded word class.
const COLUMN_PLACEHOLDER_PATTERN = /\{\{\$\scolumns\.(\w+)\s\}\}/gi;

/**
 * Reads bot columns and data, and builds the data source of one iteration.
 */
export class DataSetService {
    /**
     * Describes the data of several bots for the iterations editor.
     *
     * @param filePaths - Absolute bot file paths.
     * @returns The description of each path, by path; an unreadable bot has no columns and an error.
     */
    public static async findBotData(filePaths: string[]): Promise<Record<string, BotDataDescription>> {
        const descriptions: Record<string, BotDataDescription> = {};

        // Describe each bot once, so duplicate plan items of the same bot share one read.
        for (const filePath of new Set(filePaths)) {
            descriptions[filePath] = await DataSetService.readBotData(filePath);
        }

        return descriptions;
    }

    /**
     * Returns the data columns of a bot: its {{$ columns.Name }} placeholders, in order of first use.
     *
     * @param bot - The parsed bot.
     * @returns The column names; a name used with different casing is listed once, as first written.
     */
    public static getColumns(bot: any): string[] {
        // Scan the serialized stages: the engine resolves columns only inside rules.
        const stagesJson = JSON.stringify(bot?.stages ?? []);
        const columns: string[] = [];
        const seenNames = new Set<string>();

        // Keep the first spelling of each name, because the engine matches names case-insensitively.
        for (const match of stagesJson.matchAll(COLUMN_PLACEHOLDER_PATTERN)) {
            const name = match[1];
            const normalizedName = name.toLowerCase();

            if (seenNames.has(normalizedName)) {
                continue;
            }

            seenNames.add(normalizedName);
            columns.push(name);
        }

        return columns;
    }

    /**
     * Reads a data file written by the iterations editor.
     *
     * @param filePath - The file to read.
     * @returns The data file, or null when the file is missing, not JSON, or not a data file.
     */
    public static async readDataFile(filePath: string): Promise<DataFile | null> {
        try {
            const data = await JsonReader.readFile(filePath);
            const isDataFile = data?.type === DATA_FILE_TYPE && Array.isArray(data.iterations);

            return isDataFile ? data : null;
        } catch {
            return null;
        }
    }

    /**
     * Sets the one-row data source of an iteration on an engine request.
     *
     * @param request - The engine request (changed in place).
     * @param bot - The parsed bot the request was built from (only read).
     * @param values - The item's values in this iteration, by column name.
     * @returns The row that was sent, or undefined for a static bot (the request is unchanged).
     *
     * @remarks
     * The row holds exactly the bot's current columns, so a removed placeholder never sends a stale
     * value and a new one sends an empty value. Values are sent as text, so a column never mixes
     * types (the engine rejects a column with mixed types). The row replaces the bot's own data
     * source for this execution only; the bot file is never changed.
     */
    public static setDataSource(request: any, bot: any, values: Record<string, string>): Record<string, string> | undefined {
        // Leave a static bot unchanged: without placeholders a data source has nothing to fill.
        const columns = DataSetService.getColumns(bot);

        if (columns.length === 0) {
            return undefined;
        }

        // Build the row from the bot's current columns, so it always matches the placeholders.
        const row = DataSetService.newRow(columns, values);

        // Send the row as Base64 of a one-row JSON array, which the engine decodes before reading it.
        request.dataSource = {
            type: JSON_DATA_SOURCE_TYPE,
            source: Buffer.from(JSON.stringify([row]), 'utf8').toString('base64')
        };

        return row;
    }

    /**
     * Writes a data file, creating its folder.
     *
     * @param filePath - Target file.
     * @param data - The data file.
     */
    public static async writeDataFile(filePath: string, data: DataFile): Promise<void> {
        await fs.mkdir(path.dirname(filePath), { recursive: true });
        await fs.writeFile(filePath, JSON.stringify(data, null, 4), 'utf8');
    }

    /**
     * Converts data source text into JSON text: JSON as it is, anything else decoded from Base64.
     *
     * @param text - The source text (inline JSON, Base64, or file contents).
     * @returns The JSON text, or null when the text is neither JSON nor Base64 of JSON.
     */
    private static convertToJson(text: string): string | null {
        // Trim the text, so whitespace and a byte order mark never hide the JSON start.
        const json = DataSetService.convertToTrimmedText(text);

        // Use JSON as it is; '[' and '{' are not Base64 characters, so this test cannot mistake Base64.
        if (DataSetService.testJsonStart(json)) {
            return json;
        }

        // Decode Base64 the same way the engine does, and accept the result only when it is JSON.
        const decoded = DataSetService.convertToTrimmedText(Buffer.from(json, 'base64').toString('utf8'));

        return DataSetService.testJsonStart(decoded) ? decoded : null;
    }

    /**
     * Converts a data value into the text shown in a table cell.
     *
     * @param value - A value of a data source row.
     * @returns The text: strings as they are, other primitives as written, objects as JSON.
     */
    private static convertToText(value: unknown): string {
        // Treat a missing value as an empty cell.
        if (value === null || value === undefined) {
            return '';
        }

        // Keep text and primitives as written, so a number or boolean shows like in the source.
        if (typeof value === 'string') {
            return value;
        }

        // Write numbers, booleans, and big integers in their source form after narrowing them.
        const isPrimitive = typeof value === 'number' || typeof value === 'boolean' || typeof value === 'bigint';

        if (isPrimitive) {
            return `${value}`;
        }

        // Show nested objects and arrays as JSON instead of '[object Object]'.
        return JSON.stringify(value);
    }

    /**
     * Removes surrounding whitespace and a leading byte order mark.
     *
     * @param text - The text.
     * @returns The trimmed text.
     */
    private static convertToTrimmedText(text: string): string {
        const trimmedText = text.trim();

        // Drop a byte order mark some editors write before the data, then trim what follows it.
        if (!trimmedText.startsWith(BYTE_ORDER_MARK)) {
            return trimmedText;
        }

        return trimmedText.slice(1).trim();
    }

    /**
     * Builds a row that holds exactly the given columns.
     *
     * @param columns - The bot's current columns.
     * @param values - Values by column name; names match case-insensitively, like the engine.
     * @returns The row; a column without a value is empty.
     */
    private static newRow(columns: string[], values: Record<string, string>): Record<string, string> {
        // Index the values case-insensitively, because the engine matches column names that way.
        const valuesByName = new Map(Object.entries(values ?? {}).map(([name, value]) => [name.toLowerCase(), value]));
        const row: Record<string, string> = {};

        // Fill each current column, so removed columns are dropped and new ones are empty.
        for (const column of columns) {
            row[column] = DataSetService.convertToText(valuesByName.get(column.toLowerCase()));
        }

        return row;
    }

    /**
     * Reads the columns and own rows of one bot.
     *
     * @param filePath - The bot file.
     * @returns The description; an unreadable bot has no columns and the reason in error.
     */
    private static async readBotData(filePath: string): Promise<BotDataDescription> {
        // Read the bot; a bot that cannot be read has no columns, and the editor shows why.
        let bot: any;

        try {
            bot = await JsonReader.readFile(filePath);
        } catch (error: unknown) {
            return { columns: [], rows: [], error: `The bot cannot be read: ${DataSetService.resolveErrorMessage(error)}` };
        }

        // Read the columns, then the bot's own rows, which fill the cells of new iterations.
        const columns = DataSetService.getColumns(bot);
        const { rows, error } = await DataSetService.readBotRows(bot, filePath, columns);

        return { columns, rows, error };
    }

    /**
     * Reads the rows of a bot's own data source, as text, holding only the bot's columns.
     *
     * @param bot - The parsed bot.
     * @param filePath - The bot file, used to resolve a relative data source file.
     * @param columns - The bot's columns.
     * @returns The rows, and the reason when the data source could not be read.
     *
     * @remarks
     * The engine reads a file path on its own machine; here a path is read from this machine,
     * absolute or relative to the bot file. A source that cannot be read only means the editor
     * starts new cells empty, so the reason is reported but nothing fails.
     */
    private static async readBotRows(bot: any, filePath: string, columns: string[]): Promise<{ rows: Record<string, string>[]; error: string }> {
        // Skip bots without columns or without a source: there is nothing to start new cells from.
        const source = bot?.dataSource?.source;
        const isSourceMissing = typeof source !== 'string' || source.trim() === '';
        const isStatic = columns.length === 0;
        const isNothingToRead = isStatic || isSourceMissing;

        if (isNothingToRead) {
            return { rows: [], error: '' };
        }

        // Read a file source (absolute, or relative to the bot), otherwise use the source text itself.
        const sourcePath = path.isAbsolute(source) ? source : path.join(path.dirname(filePath), source);
        let text = source;

        try {
            const stat = await fs.stat(sourcePath);

            if (stat.isFile()) {
                text = await fs.readFile(sourcePath, 'utf8');
            }
        } catch {
            // Not a readable file: the source is inline JSON or Base64.
        }

        // Convert the text into rows; a source that is not a JSON array of objects starts cells empty.
        const json = DataSetService.convertToJson(text);

        if (json === null) {
            return { rows: [], error: 'The bot data source is not a file, a JSON array, or Base64 of a JSON array.' };
        }

        let parsed: unknown;

        try {
            parsed = JSON.parse(json);
        } catch (error: unknown) {
            return { rows: [], error: `The bot data source is not valid JSON: ${DataSetService.resolveErrorMessage(error)}` };
        }

        if (!Array.isArray(parsed)) {
            return { rows: [], error: 'The bot data source is not a JSON array of rows.' };
        }

        // Keep object rows only, each reduced to the bot's columns as text.
        const rows = parsed
            .filter((row) => row !== null && typeof row === 'object' && !Array.isArray(row))
            .map((row) => DataSetService.newRow(columns, row));

        return { rows, error: '' };
    }

    /**
     * Resolves a readable message from a thrown value.
     *
     * @param error - The thrown value.
     * @returns The error message, the thrown text, or a JSON form of any other value.
     */
    private static resolveErrorMessage(error: unknown): string {
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

    /**
     * Tests whether text starts like JSON data.
     *
     * @param text - Trimmed text.
     * @returns True when the text starts with '[' or '{'.
     */
    private static testJsonStart(text: string): boolean {
        return text.startsWith('[') || text.startsWith('{');
    }
}
