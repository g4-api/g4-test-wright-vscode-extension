/*
 * Converts a Test Wright run (run.json + one .g4rpt per bot) into Allure results.
 *
 * Mapping (mirrors g4-pytest-wrapper's Allure reporter so both produce the same report shape):
 * - One execution (a plan item in one iteration) = one Allure test result. Suite labels:
 *   parentSuite = bots folder name, suite = the bot's folder (suite), plus one tag label per
 *   reference.tags entry. A bot that appears at several plan positions, or a run with iterations,
 *   gets Position, Iteration, and the row values as parameters and its own history id.
 * - Steps: stage > job > plugin, nested by child plugins. A stage step is written only when the
 *   session has several stages, and a job step only when the stage has several jobs.
 * - Plugin step attachments: the assertion entities (Assert), screenshots, and the exceptions JSON.
 *   The rule JSON is not attached (the step name and parameters describe the rule).
 * - Screenshots: AutoScreenshot:* extraction values on every rule; SaveScreenshot (and its aliases
 *   GetScreenshot, TakeScreenshot) attach the image they saved. A value is a file path, Base64, or
 *   a data: URI; anything that is not a PNG or JPEG image is attached as text.
 * - Status: failed assertion = failed; exceptions without failed assertions = broken (the Test
 *   Wright "warning"); bots that never ran = broken; canceled bots = skipped.
 * - Layout: a run's Allure files live beside the run folder, never inside it:
 *     reports/<run>/                   run.json and the .g4rpt files
 *     reports/allure-<run>/results/    Allure results
 *     reports/allure-<run>/report/     generated Allure report
 *     reports/allure-merged/           report merged from several runs
 *
 * RESOURCES:
 * Allure result format: https://allurereport.org/docs/how-it-works-test-result-file/
 */
import * as crypto from 'node:crypto';
import * as fs from 'node:fs/promises';
import * as os from 'node:os';
import * as path from 'node:path';
import { JsonReader } from '../extensions/json-reader';
import { ResultEvaluator } from './result-evaluator';
import { RunRecord, TestRecord, TestStatus } from '../models/test-wright-models';

// Test Wright's Allure categories: written to categories.json (Allure 2) and to the Allure 3 config.
export const ALLURE_CATEGORIES = [
    { name: 'Failed assertions', matchedStatuses: ['failed'] },
    { name: 'Exceptions (warnings)', matchedStatuses: ['broken'], messageRegex: '^(?!Engine unreachable|HTTP ).*' },
    { name: 'Engine or transport errors', matchedStatuses: ['broken'], messageRegex: '^(Engine unreachable|HTTP ).*' },
    { name: 'Canceled', matchedStatuses: ['skipped'] }
];

// Prefix of every Allure folder under the reports folder.
export const ALLURE_FOLDER_PREFIX = 'allure-';

// Folder of a report merged from several runs.
export const ALLURE_MERGED_FOLDER = 'allure-merged';

// Prefix of extraction keys that hold AutoScreenshot images.
const AUTO_SCREENSHOT_PREFIX = 'AutoScreenshot:';

// Base64 text (standard alphabet, optional end padding). Linear: one character class, one quantifier.
const BASE64_PATTERN = /^[A-Za-z0-9+/]+={0,2}$/;

// A "data:image/...;base64," prefix some engines put before Base64 images.
// Linear: literal text and negated character classes with single quantifiers.
const DATA_URI_PREFIX_PATTERN = /^data:[^;,]*;base64,/i;

// Regular expressions G4 uses as "match anything"; not worth an attachment.
const DEFAULT_REGULAR_EXPRESSIONS = new Set(['(?s).*', '.*']);

// Image types the report shows inline.
const IMAGE_TYPES = {
    jpeg: { type: 'image/jpeg', extension: 'jpg' },
    png: { type: 'image/png', extension: 'png' }
};

// First bytes of a JPEG image.
const JPEG_SIGNATURE = Buffer.from([0xff, 0xd8, 0xff]);

// First bytes of a PNG image.
const PNG_SIGNATURE = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

// Session parameter where the SaveScreenshot plugin appends every image it saved (Base64 JSON array).
const SAVE_SCREENSHOT_PARAMETER = 'SaveScreenshot:Screenshots';

// SaveScreenshot plugin name (also the attachment name prefix).
const SAVE_SCREENSHOT_PLUGIN = 'SaveScreenshot';

// SaveScreenshot and its aliases (lowercase).
const SAVE_SCREENSHOT_PLUGINS = new Set(['savescreenshot', 'getscreenshot', 'takescreenshot']);

// Whitespace inside Base64 text (line breaks of wrapped payloads).
const WHITESPACE_PATTERN = /\s+/g;

/**
 * Writes Allure results for a run folder.
 */
export class AllureConverter {
    // Folder the current conversion writes into.
    private readonly _resultsFolder: string;

    /**
     * Creates a converter that writes into one results folder.
     *
     * @param resultsFolder - Target results folder (created when missing).
     */
    constructor(resultsFolder: string) {
        this._resultsFolder = resultsFolder;
    }

    /**
     * Converts a run folder into `allure-<run>/results` beside it.
     *
     * @param runFolder - The run folder that holds run.json.
     * @returns The results folder and the number of test results written.
     */
    public static async convertRun(runFolder: string): Promise<{ resultsFolder: string; count: number }> {
        const record: RunRecord = await JsonReader.readFile(path.join(runFolder, 'run.json'));
        const resultsFolder = AllureConverter.getResultsFolder(runFolder);

        // A re-conversion replaces the previous results instead of doubling them.
        await fs.rm(resultsFolder, { recursive: true, force: true });
        await fs.mkdir(resultsFolder, { recursive: true });

        const converter = new AllureConverter(resultsFolder);
        const childIds: string[] = [];

        for (const test of record.tests) {
            const response = await AllureConverter.readReport(runFolder, test);
            childIds.push(await converter.writeTestResult(record, test, response));
        }

        await converter.writeRunFiles(record, childIds);

        return { resultsFolder, count: childIds.length };
    }

    /**
     * Returns the Allure folder of a run: `allure-<run>` beside the run folder.
     *
     * @param runFolder - The run folder that holds run.json.
     * @returns The run's Allure folder.
     */
    public static getAllureFolder(runFolder: string): string {
        return path.join(path.dirname(runFolder), `${ALLURE_FOLDER_PREFIX}${path.basename(runFolder)}`);
    }

    /**
     * Returns the generated Allure report folder of a run: `allure-<run>/report`.
     *
     * @param runFolder - The run folder that holds run.json.
     * @returns The report folder.
     */
    public static getReportFolder(runFolder: string): string {
        return path.join(AllureConverter.getAllureFolder(runFolder), 'report');
    }

    /**
     * Returns the Allure results folder of a run: `allure-<run>/results`.
     *
     * @param runFolder - The run folder that holds run.json.
     * @returns The results folder.
     */
    public static getResultsFolder(runFolder: string): string {
        return path.join(AllureConverter.getAllureFolder(runFolder), 'results');
    }

    /**
     * Maps a Test Wright status to an Allure status.
     *
     * @param status - The Test Wright status.
     * @returns passed, failed, broken, or skipped.
     */
    public static getAllureStatus(status: TestStatus): AllureStatus {
        switch (status) {
            case 'passed':
                return 'passed';
            case 'failed':
                return 'failed';
            case 'canceled':
            case 'not-run':
                return 'skipped';
            default:
                // warning (exceptions) and broken (never ran) are both Allure's broken.
                return 'broken';
        }
    }

    /**
     * Writes one test result (and its attachments) for one bot.
     *
     * @param record - The run record.
     * @param test - The bot entry.
     * @param response - The bot's automation response, or null when it never ran.
     * @returns The test result uuid.
     */
    public async writeTestResult(record: RunRecord, test: TestRecord, response: any): Promise<string> {
        const uuid = crypto.randomUUID();
        const historyId = crypto.createHash('md5').update(AllureConverter.getHistoryKey(record, test)).digest('hex');

        // A bot canceled before it started has no times (0); the run start keeps it out of 1970,
        // which would stretch the report's timeline and total duration over decades.
        const runStart = Date.parse(record.startedAt) || Date.now();
        const start = test.start || runStart;
        const result: AllureResult = {
            uuid,
            historyId,
            testCaseId: historyId,
            name: test.name,
            fullName: test.id,
            status: AllureConverter.getAllureStatus(test.status),
            statusDetails: { message: test.message },
            stage: 'finished',
            start,
            stop: test.stop || start,
            labels: this.newLabels(record, test, response),

            // Parameters only where results need telling apart (Allure appends them to the title):
            // the plan position and iteration, and the row values sent in that iteration. The
            // environment and engine are labels instead (and the run's values are in environment.properties).
            parameters: AllureConverter.newParameters(record, test),
            links: [],
            steps: [],
            attachments: []
        };

        if (response !== null) {
            result.steps = await this.newSessionSteps(response);
            result.attachments.push(await this.writeAttachment('g4-response', JSON.stringify(response, null, 4), 'application/json', 'json'));
        }

        await fs.writeFile(path.join(this._resultsFolder, `${uuid}-result.json`), JSON.stringify(result, null, 2), 'utf8');

        return uuid;
    }

    /**
     * Writes the run container, environment.properties, executor.json, and categories.json.
     *
     * @param record - The run record.
     * @param childIds - The test result uuids of the run.
     */
    public async writeRunFiles(record: RunRecord, childIds: string[]): Promise<void> {
        const container = {
            uuid: crypto.randomUUID(),
            name: record.label || record.name,
            children: childIds,
            befores: [],
            afters: [],
            start: Date.parse(record.startedAt),
            stop: Date.parse(record.finishedAt)
        };

        await fs.writeFile(path.join(this._resultsFolder, `${container.uuid}-container.json`), JSON.stringify(container, null, 2), 'utf8');

        const properties = [
            `Run=${record.name}`,
            `Environment=${record.environment || '(none)'}`,
            `Engine=${record.engine}`,
            `Bots.Folder=${(record.botsFolder ?? '').split('\\').join('/')}`,
            `Parallel=${record.parallel}`,
            `Scheduled=${record.scheduled}`
        ];

        await fs.writeFile(path.join(this._resultsFolder, 'environment.properties'), properties.join('\n'), 'utf8');

        const executor = {
            name: 'G4 Studio Test Wright',
            type: 'g4',
            buildName: record.label || record.name,
            reportName: `G4 Run ${record.name}`
        };

        await fs.writeFile(path.join(this._resultsFolder, 'executor.json'), JSON.stringify(executor, null, 2), 'utf8');

        // Read by Allure 2 readers; Allure 3 gets the same rules through its config (ALLURE_CATEGORIES).
        await fs.writeFile(path.join(this._resultsFolder, 'categories.json'), JSON.stringify(ALLURE_CATEGORIES, null, 2), 'utf8');
    }

    /**
     * Returns the key Allure tracks history by, so each execution keeps its own history.
     *
     * @param record - The run record.
     * @param test - The execution.
     * @returns The bot id, plus the plan position when the bot appears more than once, plus the
     * iteration when the plan has iterations ('smoke/login.json#4@2').
     */
    public static getHistoryKey(record: RunRecord, test: TestRecord): string {
        const positionText = AllureConverter.testDuplicate(record, test) ? `#${test.position}` : '';
        const iterationText = test.iteration ? `@${test.iteration}` : '';

        return `${test.id}${positionText}${iterationText}`;
    }

    /**
     * Builds the Allure parameters of one execution.
     *
     * @param record - The run record.
     * @param test - The execution.
     * @returns Position (for a bot that appears more than once), Iteration, and the row values;
     * empty for a single bot run without iterations, so its title stays plain.
     */
    public static newParameters(record: RunRecord, test: TestRecord): AllureParameter[] {
        const parameters: AllureParameter[] = [];

        // Tell duplicate plan items of the same bot apart by their plan position.
        if (AllureConverter.testDuplicate(record, test)) {
            parameters.push({ name: 'Position', value: `#${test.position}` });
        }

        // Name the iteration and the values it sent, so each row reads as its own test case.
        if (test.iteration) {
            parameters.push({ name: 'Iteration', value: `${test.iteration}` });
        }

        for (const [name, value] of Object.entries(test.values ?? {})) {
            parameters.push({ name, value });
        }

        return parameters;
    }

    /**
     * Tests whether a bot appears at more than one plan position in a run.
     *
     * @param record - The run record.
     * @param test - The execution.
     * @returns True when another execution of the same bot has a different position.
     */
    public static testDuplicate(record: RunRecord, test: TestRecord): boolean {
        if (!test.position) {
            return false;
        }

        return record.tests.some((candidate) => candidate.id === test.id && candidate.position !== test.position);
    }

    /**
     * Reads the decoded automation response of one bot.
     *
     * @param runFolder - The run folder.
     * @param test - The bot entry.
     * @returns The response, or null when the bot has no report (it never ran).
     */
    public static async readReport(runFolder: string, test: TestRecord): Promise<any> {
        if (!test.reportFile) {
            return null;
        }

        try {
            const base64 = await fs.readFile(path.join(runFolder, test.reportFile), 'utf8');

            return JSON.parse(Buffer.from(base64.trim(), 'base64').toString('utf8'));
        } catch {
            return null;
        }
    }

    // Builds the steps of every session, skipping single-stage and single-job wrappers.
    private async newSessionSteps(response: any): Promise<AllureStep[]> {
        const steps: AllureStep[] = [];

        for (const session of ResultEvaluator.getSessions(response)) {
            const stages: any[] = session?.responseTree?.stages ?? [];
            const isMultiStage = stages.length > 1;
            const screenshots: SessionScreenshots = { values: AllureConverter.getSessionScreenshots(session), next: 0 };

            for (const stage of stages) {
                const jobSteps = await this.newJobSteps(stage?.jobs ?? [], screenshots);

                if (isMultiStage) {
                    steps.push(this.newGroupStep(AllureConverter.getStageName(stage), jobSteps));
                } else {
                    steps.push(...jobSteps);
                }
            }
        }

        return steps;
    }

    // Builds the steps of a stage's jobs.
    private async newJobSteps(jobs: any[], screenshots: SessionScreenshots): Promise<AllureStep[]> {
        const steps: AllureStep[] = [];
        const isMultiJob = jobs.length > 1;

        for (const job of jobs) {
            const pluginSteps: AllureStep[] = [];

            for (const plugin of job?.plugins ?? []) {
                pluginSteps.push(await this.newPluginStep(plugin, screenshots));
            }

            if (isMultiJob) {
                steps.push(this.newGroupStep(AllureConverter.getJobName(job), pluginSteps));
            } else {
                steps.push(...pluginSteps);
            }
        }

        return steps;
    }

    // Builds one plugin step, its attachments (no rule JSON), and its child steps.
    private async newPluginStep(plugin: any, screenshots: SessionScreenshots): Promise<AllureStep> {
        const rule = plugin?.rule ?? {};
        const point = plugin?.performancePoint ?? {};
        const step: AllureStep = {
            name: rule?.capabilities?.displayName || rule?.pluginName || 'Rule',
            status: 'passed',
            statusDetails: {},
            stage: 'finished',
            start: AllureConverter.getTime(point.start),
            stop: AllureConverter.getTime(point.end),
            parameters: AllureConverter.newRuleParameters(rule),
            attachments: [],
            steps: []
        };

        // Assert rules attach their entities and fail the step when the evaluation is false.
        if (ResultEvaluator.testAssert(plugin)) {
            const assertion = ResultEvaluator.getAssertion(plugin);

            if (assertion.entities.length > 0) {
                step.attachments.push(await this.writeAttachment('assertion', JSON.stringify(assertion.entities, null, 4), 'application/json', 'json'));
            }

            if (!assertion.evaluation) {
                step.status = 'failed';
                step.statusDetails = { message: 'Assertion failed.' };
            }
        }

        // SaveScreenshot rules attach the image they saved; every other rule its AutoScreenshots.
        if (AllureConverter.testSaveScreenshot(plugin)) {
            const screenshot = AllureConverter.getSaveScreenshot(plugin, screenshots);

            if (screenshot !== '') {
                step.attachments.push(await this.writeScreenshot(AllureConverter.getSaveScreenshotName(plugin), screenshot));
            }
        } else {
            for (const [name, value] of AllureConverter.getAutoScreenshots(plugin)) {
                step.attachments.push(await this.writeScreenshot(name, value));
            }
        }

        for (const child of plugin?.plugins ?? []) {
            const childStep = await this.newPluginStep(child, screenshots);

            step.steps.push(childStep);
            step.status = AllureConverter.getWorstStatus(step.status, childStep.status);
        }

        const exceptions = ResultEvaluator.getPluginExceptions(plugin);

        if (exceptions.length > 0) {
            const payload = exceptions.map((entry) => entry.exception);

            step.attachments.push(await this.writeAttachment('exceptions', JSON.stringify(payload, null, 4), 'application/json', 'json'));
            step.status = AllureConverter.getWorstStatus(step.status, 'broken');
            step.statusDetails = {
                message: ResultEvaluator.getExceptionMessage(exceptions[0]),
                trace: `${exceptions[0].exception?.StackTrace ?? ''}`
            };
        }

        return step;
    }

    // Builds a wrapper step (stage or job) whose status is the worst of its children.
    private newGroupStep(name: string, children: AllureStep[]): AllureStep {
        const starts = children.map((child) => child.start).filter((time) => time > 0);
        const stops = children.map((child) => child.stop).filter((time) => time > 0);

        return {
            name,
            status: children.reduce<AllureStatus>((worst, child) => AllureConverter.getWorstStatus(worst, child.status), 'passed'),
            statusDetails: {},
            stage: 'finished',
            start: starts.length > 0 ? Math.min(...starts) : 0,
            stop: stops.length > 0 ? Math.max(...stops) : 0,
            parameters: [],
            attachments: [],
            steps: children
        };
    }

    // Builds the labels of a test result.
    private newLabels(record: RunRecord, test: TestRecord, response: any): AllureLabel[] {
        const suite = test.suite || path.basename(record.botsFolder);
        const labels: AllureLabel[] = [
            { name: 'parentSuite', value: path.basename(record.botsFolder) || 'bots' },
            { name: 'suite', value: suite },
            { name: 'package', value: suite.split('/').join('.') },
            { name: 'testClass', value: suite },
            { name: 'testMethod', value: test.name },
            { name: 'host', value: AllureConverter.getMachineName(response) },
            { name: 'thread', value: record.parallel ? 'parallel' : 'sequential' },
            { name: 'framework', value: 'G4' },
            { name: 'language', value: 'g4' },
            { name: 'g4.environment', value: record.environment || '(none)' },
            { name: 'g4.engine', value: record.engine }
        ];

        for (const tag of test.tags) {
            labels.push({ name: 'tag', value: tag });
        }

        return labels;
    }

    // Writes a text attachment and returns its entry.
    private async writeAttachment(name: string, content: string | Buffer, type: string, extension: string): Promise<AllureAttachment> {
        const source = `${crypto.randomUUID()}-attachment.${extension}`;

        await fs.writeFile(path.join(this._resultsFolder, source), content);

        return { name, source, type };
    }

    // Writes a screenshot from a file path, Base64 (or a data: URI); falls back to text otherwise.
    private async writeScreenshot(name: string, value: string): Promise<AllureAttachment> {
        try {
            const stat = await fs.stat(value);

            if (stat.isFile()) {
                const bytes = await fs.readFile(value);
                const image = AllureConverter.getImageType(bytes) ?? IMAGE_TYPES.png;

                return this.writeAttachment(name, bytes, image.type, image.extension);
            }
        } catch {
            // Not a file path; try Base64 below.
        }

        const base64 = value.replace(DATA_URI_PREFIX_PATTERN, '').replace(WHITESPACE_PATTERN, '');

        if (BASE64_PATTERN.test(base64)) {
            const bytes = Buffer.from(base64, 'base64');
            const image = AllureConverter.getImageType(bytes);

            if (image !== null) {
                return this.writeAttachment(name, bytes, image.type, image.extension);
            }
        }

        // Neither a file nor an image: keep the value so the report still shows what the engine sent.
        return this.writeAttachment(name, value, 'text/plain', 'txt');
    }

    // Reads the image type from the first bytes (PNG or JPEG), or null when it is not an image.
    private static getImageType(bytes: Buffer): { type: string; extension: string } | null {
        if (bytes.subarray(0, PNG_SIGNATURE.length).equals(PNG_SIGNATURE)) {
            return IMAGE_TYPES.png;
        }

        if (bytes.subarray(0, JPEG_SIGNATURE.length).equals(JPEG_SIGNATURE)) {
            return IMAGE_TYPES.jpeg;
        }

        return null;
    }

    /**
     * Returns the image a SaveScreenshot rule saved (a file path or Base64), or an empty string.
     *
     * @remarks
     * The plugin returns the image on its own response entity ("Screenshot") and also appends it to
     * the session parameter "SaveScreenshot:Screenshots", once per call, in execution order. The
     * entity is used when present; otherwise the nth SaveScreenshot rule of the session takes the
     * nth list entry, and the last entry when the list is shorter (the g4-pytest-wrapper behavior).
     *
     * @param plugin - A SaveScreenshot plugin node.
     * @param screenshots - The session's screenshot list and the next unused position.
     * @returns The screenshot value.
     */
    private static getSaveScreenshot(plugin: any, screenshots: SessionScreenshots): string {
        const position = screenshots.next++;

        for (const extraction of plugin?.extractions ?? []) {
            for (const entity of extraction?.entities ?? []) {
                const value = entity?.content?.Screenshot;

                if (typeof value === 'string' && value !== '') {
                    return value;
                }
            }
        }

        return screenshots.values[position] ?? screenshots.values.at(-1) ?? '';
    }

    // Attachment name of a SaveScreenshot image: SaveScreenshot.<yyyyMMdd_HHmmssfff> from the rule's end time (UTC).
    private static getSaveScreenshotName(plugin: any): string {
        const end = new Date(`${plugin?.performancePoint?.end ?? ''}`);

        if (Number.isNaN(end.getTime())) {
            return SAVE_SCREENSHOT_PLUGIN;
        }

        const pad = (value: number, length = 2): string => value.toString().padStart(length, '0');
        const date = `${end.getUTCFullYear()}${pad(end.getUTCMonth() + 1)}${pad(end.getUTCDate())}`;
        const time = `${pad(end.getUTCHours())}${pad(end.getUTCMinutes())}${pad(end.getUTCSeconds())}${pad(end.getUTCMilliseconds(), 3)}`;

        return `${SAVE_SCREENSHOT_PLUGIN}.${date}_${time}`;
    }

    /**
     * Reads the "SaveScreenshot:Screenshots" list of a session (a Base64 JSON array of paths or
     * Base64 images). The engine returns it only when environmentsSettings.returnEnvironment is on.
     *
     * @param session - A session of the response.
     * @returns The screenshot values, or an empty list.
     */
    private static getSessionScreenshots(session: any): string[] {
        const encoded = session?.environment?.sessionParameters?.[SAVE_SCREENSHOT_PARAMETER];

        if (typeof encoded !== 'string' || encoded === '') {
            return [];
        }

        try {
            const list = JSON.parse(Buffer.from(encoded, 'base64').toString('utf8'));

            return Array.isArray(list) ? list.filter((value) => typeof value === 'string' && value !== '') : [];
        } catch {
            return [];
        }
    }

    // Whether a plugin node is SaveScreenshot or one of its aliases.
    private static testSaveScreenshot(plugin: any): boolean {
        return SAVE_SCREENSHOT_PLUGINS.has(`${plugin?.rule?.pluginName ?? ''}`.toLowerCase());
    }

    // Lists AutoScreenshot entries from a plugin's extractions.
    private static getAutoScreenshots(plugin: any): [string, string][] {
        const screenshots: [string, string][] = [];

        for (const extraction of plugin?.extractions ?? []) {
            for (const entity of extraction?.entities ?? []) {
                for (const [key, value] of Object.entries(entity?.content ?? {})) {
                    if (key.startsWith(AUTO_SCREENSHOT_PREFIX) && typeof value === 'string' && value !== '') {
                        screenshots.push([key, value]);
                    }
                }
            }
        }

        return screenshots;
    }

    // Name of a job step: the job reference name of its first plugin, or "Job".
    private static getJobName(job: any): string {
        return job?.name || job?.reference?.name || job?.plugins?.[0]?.performancePoint?.reference?.jobReference?.name || 'Job';
    }

    // Reads the machine name from the first extraction session, or this machine.
    private static getMachineName(response: any): string {
        for (const session of ResultEvaluator.getSessions(response)) {
            const text = JSON.stringify(session?.responseTree ?? {});
            const match = /"machineName":"([^"]+)"/.exec(text);

            if (match) {
                return match[1];
            }
        }

        return os.hostname();
    }

    // Name of a stage step: its own name, or the stage reference of its first plugin.
    private static getStageName(stage: any): string {
        return stage?.name || stage?.reference?.name
            || stage?.jobs?.[0]?.plugins?.[0]?.performancePoint?.reference?.jobReference?.stageReference?.name
            || 'Stage';
    }

    // Converts an ISO time into epoch milliseconds (0 when missing).
    private static getTime(value: unknown): number {
        const time = typeof value === 'string' ? Date.parse(value) : Number.NaN;

        return Number.isFinite(time) ? time : 0;
    }

    // Returns the more severe of two statuses: failed > broken > skipped > passed.
    private static getWorstStatus(left: AllureStatus, right: AllureStatus): AllureStatus {
        const severity: Record<AllureStatus, number> = { passed: 0, skipped: 1, broken: 2, failed: 3 };

        return severity[right] > severity[left] ? right : left;
    }

    // Step parameters for the rule fields worth seeing at a glance.
    private static newRuleParameters(rule: any): { name: string; value: string }[] {
        const parameters: { name: string; value: string }[] = [];
        const addParameter = (name: string, value: unknown): void => {
            if (value !== undefined && value !== null && `${value}` !== '') {
                parameters.push({ name, value: `${value}` });
            }
        };

        addParameter('argument', rule?.argument);
        addParameter('onElement', rule?.onElement);
        addParameter('onAttribute', rule?.onAttribute);

        if (rule?.locator && `${rule.locator}`.toUpperCase() !== 'XPATH') {
            addParameter('locator', rule.locator);
        }

        if (rule?.regularExpression && !DEFAULT_REGULAR_EXPRESSIONS.has(rule.regularExpression)) {
            addParameter('regularExpression', rule.regularExpression);
        }

        return parameters;
    }
}

// Compile-time contracts stay after the executable code.

/**
 * One Allure attachment entry.
 */
interface AllureAttachment {
    name: string;
    source: string;
    type: string;
}

/**
 * One Allure label.
 */
interface AllureLabel {
    name: string;
    value: string;
}

/**
 * One Allure test or step parameter, shown beside the title.
 */
export interface AllureParameter {
    /** Parameter name (for example Iteration, or a data column). */
    name: string;

    /** Parameter value as text. */
    value: string;
}

/**
 * One Allure test result file.
 */
interface AllureResult {
    uuid: string;
    historyId: string;
    testCaseId: string;
    name: string;
    fullName: string;
    status: AllureStatus;
    statusDetails: { message?: string; trace?: string };
    stage: 'finished';
    start: number;
    stop: number;
    labels: AllureLabel[];
    parameters: { name: string; value: string }[];
    links: { name: string; url: string; type: string }[];
    steps: AllureStep[];
    attachments: AllureAttachment[];
}

/**
 * One Allure step.
 */
interface AllureStep {
    name: string;
    status: AllureStatus;
    statusDetails: { message?: string; trace?: string };
    stage: 'finished';
    start: number;
    stop: number;
    parameters: { name: string; value: string }[];
    attachments: AllureAttachment[];
    steps: AllureStep[];
}

/**
 * Allure statuses Test Wright produces.
 */
export type AllureStatus = 'passed' | 'failed' | 'broken' | 'skipped';

/**
 * The SaveScreenshot images of one session and the position of the next SaveScreenshot rule.
 */
interface SessionScreenshots {
    values: string[];
    next: number;
}
