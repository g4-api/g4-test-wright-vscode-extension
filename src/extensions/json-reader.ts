/*
 * Reads JSON files the way users save them.
 *
 * Windows tools (Notepad, PowerShell 5.1 Out-File, Visual Studio) often write UTF-8 with a byte
 * order mark, which JSON.parse rejects. Every JSON file Test Wright reads (bots, environments,
 * plans, run records, the manifest) goes through here. Free of the vscode module, so the services
 * that use it stay testable under plain Node.
 */
import * as fs from 'node:fs/promises';

// The UTF-8 byte order mark as decoded text.
const BYTE_ORDER_MARK = '﻿';

/**
 * JSON parsing that accepts a leading byte order mark.
 */
export class JsonReader {
    /**
     * Parses JSON text, ignoring a leading byte order mark.
     *
     * @param text - The JSON text.
     * @returns The parsed value; throws like JSON.parse when the text is not JSON.
     */
    public static convertFromText(text: string): any {
        return JSON.parse(text.startsWith(BYTE_ORDER_MARK) ? text.slice(1) : text);
    }

    /**
     * Reads and parses a UTF-8 JSON file, with or without a byte order mark.
     *
     * @param filePath - The file to read.
     * @returns The parsed value; throws when the file cannot be read or is not JSON.
     */
    public static async readFile(filePath: string): Promise<any> {
        return JsonReader.convertFromText(await fs.readFile(filePath, 'utf8'));
    }
}
