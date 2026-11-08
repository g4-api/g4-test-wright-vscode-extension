/**
 * Fails when the Test Wright README stops listing the commands the extension contributes.
 *
 * @remarks
 * Every `contributes.commands[].command` in `package.json` must appear in backticks in the
 * "Commands" section of `README.md`. The script is plain Node with no dependencies. It is
 * compute-only except for reading files and writing the report, and it exits with code 1 when any
 * command is missing.
 *
 * Usage: `node scripts/check-doc-drift.mjs` (or `npm run check:doc-drift`).
 */

import * as fs from 'node:fs';
import * as path from 'node:path';
import * as url from 'node:url';

// Resolves the repository root from this file's location so the script works from any working directory.
const REPOSITORY_ROOT = path.resolve(path.dirname(url.fileURLToPath(import.meta.url)), '..');

// Pins the two files the check compares, so a moved file fails loudly instead of passing silently.
const FILES = {
    packageManifest: path.join(REPOSITORY_ROOT, 'package.json'),
    readme: path.join(REPOSITORY_ROOT, 'README.md')
};

/**
 * Collects every command id contributed by the extension.
 *
 * @param {object} packageManifest The parsed `package.json`.
 * @returns {string[]} The sorted, unique command ids that the README must mention.
 */
function getContributedCommands(packageManifest) {
    // Read the contribution list defensively so a manifest without commands yields an empty check.
    const commands = packageManifest?.contributes?.commands ?? [];

    // Keep each command id once, in A-Z order, so the report is stable.
    return [...new Set(commands.map((command) => command.command))].sort();
}

/**
 * Returns the text of the "Commands" section of the README.
 *
 * @param {string} readmeText The text of `README.md`.
 * @returns {string} The section text, or an empty string when the section is missing.
 */
function getCommandsSection(readmeText) {
    // Find where the section starts; a missing heading means every command is undocumented.
    const startIndex = readmeText.indexOf('\n## Commands');

    if (startIndex === -1) {
        return '';
    }

    // End the section at the next level-2 heading so commands mentioned elsewhere do not count.
    const endIndex = readmeText.indexOf('\n## ', startIndex + 1);

    if (endIndex === -1) {
        return readmeText.slice(startIndex);
    }

    return readmeText.slice(startIndex, endIndex);
}

/**
 * Reads the input files, runs the check and reports the result.
 *
 * @returns {number} The process exit code: 0 when the README matches the code, 1 otherwise.
 */
function invokeChecks() {
    // Stop with a clear message when an input file moved, because a missing file would hide drift.
    const missingFiles = Object.values(FILES).filter((filePath) => !fs.existsSync(filePath));

    if (missingFiles.length > 0) {
        console.error('Doc drift check cannot run. Missing files:');

        for (const filePath of missingFiles) {
            console.error('  ' + path.relative(REPOSITORY_ROOT, filePath));
        }

        return 1;
    }

    // Load the code-side and doc-side inputs once.
    const packageManifest = JSON.parse(fs.readFileSync(FILES.packageManifest, 'utf8'));
    const commandsSection = getCommandsSection(fs.readFileSync(FILES.readme, 'utf8'));

    // Compare what the code contributes with what the README documents.
    const commands = getContributedCommands(packageManifest);
    const missingCommands = commands.filter((command) => !commandsSection.includes('`' + command + '`'));

    // Report the totals first so a passing run still shows what was compared.
    console.log(`Commands checked: ${commands.length}, missing: ${missingCommands.length}`);

    // Name each missing command so the author knows exactly which table row to add.
    for (const command of missingCommands) {
        console.error(`MISSING in README.md (Commands section): ${command}`);
    }

    return missingCommands.length === 0 ? 0 : 1;
}

process.exitCode = invokeChecks();
