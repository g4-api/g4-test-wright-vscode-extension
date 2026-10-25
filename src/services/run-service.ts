/*
 * Runs bots against the G4 engine and records the run.
 *
 * A run executes its plan items one after another, or with a worker pool sized to the CPU count when
 * Parallel Tests is on. Every plan item runs on its own, even when several items point at the same
 * bot. When the plan has iterations, the whole suite runs once per included iteration, and each item
 * sends its row of that iteration as a one-row data source. Each finished execution is saved as a
 * Base64 .g4rpt (the G4 Studio report format) inside the run folder
 * `<reports>/<yyyy-MM-dd-HHmmssfff>/`, next to run.json. When Allure collection is on, the results go
 * to `<reports>/allure-<run>/results/` beside the run folder.
 */
import * as fs from 'node:fs/promises';
import * as os from 'node:os';
import * as path from 'node:path';
import * as vscode from 'vscode';

import { existsSync } from 'node:fs';

import { G4Client } from '../clients/g4-client';

import { JsonReader } from '../extensions/json-reader';
import { Utilities } from '../extensions/utilities';

import { Logger } from '../logging/logger';

import {
    RunEvent,
    RunRecord,
    RunRequest,
    RunSummary,
    RunTally,
    RunTest,
    TestRecord,
    TestStatus
} from '../models/test-wright-models';

import { AllureConverter } from './allure-converter';
import { BotRequestBuilder } from './bot-request-builder';
import { BotsDiscoveryService } from './bots-discovery-service';
import { DataSetService } from './data-set-service';
import { ResultEvaluator } from './result-evaluator';

/**
 * Executes runs and tracks the active ones so they can be stopped.
 */
export class RunService implements vscode.Disposable {
    // Fires for every live run event (start, result, log).
    private readonly _onRunEvent = new vscode.EventEmitter<RunEvent>();

    // Fires when the number of active runs changes.
    private readonly _onActiveRunsChanged = new vscode.EventEmitter<number>();

    // Active runs by id: their abort controllers and whether Stop was requested.
    private readonly _activeRuns = new Map<number, { controllers: Set<AbortController>; canceled: boolean }>();

    // Run folders of the active runs, so two runs started in the same millisecond never share one.
    private readonly _activeRunFolders = new Set<string>();

    // Named logger for run diagnostics.
    private readonly _logger: Logger;

    /**
     * Creates the run service.
     *
     * @param logger - Parent logger.
     */
    constructor(logger: Logger) {
        this._logger = logger.newLogger('G4.TestWright.RunService');
    }

    /** Live run events, for the webview console and badges. */
    public readonly onRunEvent = this._onRunEvent.event;

    /** Active run count changes, for the scheduler queue and the status pill. */
    public readonly onActiveRunsChanged = this._onActiveRunsChanged.event;

    /** Number of runs in flight. */
    public get activeRunCount(): number {
        return this._activeRuns.size;
    }

    /**
     * Releases the event emitters and cancels runs still in flight.
     */
    public dispose(): void {
        for (const runId of this._activeRuns.keys()) {
            this.stopRun(runId);
        }

        this._onRunEvent.dispose();
        this._onActiveRunsChanged.dispose();
    }

    /**
     * Runs a set of bots and writes the run folder.
     *
     * @param request - The bots and options of the run.
     * @returns The run summary once every bot finished (or was canceled).
     */
    public async invokeRun(request: RunRequest): Promise<RunSummary> {
        const runEntry = { controllers: new Set<AbortController>(), canceled: false };
        const startedAt = new Date();
        const { runName, runFolder } = this.newRunFolder(startedAt);
        const manifest = Utilities.updateManifest();
        const engine = Utilities.getEngineEndpoint();
        const client = new G4Client(engine);
        const usedReportNames = new Set<string>();
        // Send each console line to the open panels and write it to the G4 Test Wright output channel too, so a run
        // started with no panel open (for example a scheduled run) is still logged.
        const log = (text: string, kind = 'muted'): void => {
            this._onRunEvent.fire({ runId: request.runId, type: 'log', text, kind });
            this.writeRunLog(text, kind);
        };

        // Name the run the same way in every console line: its folder name, plus the schedule label for
        // a scheduled run, so the start, finish, cancel, and failure lines of one run are easy to match.
        const runTitle = RunService.getRunTitle(runName, request);

        // One pass per included iteration (or one pass without data), and one record per plan item in
        // each pass, so every item runs on its own, even when several items point at the same bot.
        const passes = RunService.getPasses(request);
        const records: TestRecord[] = passes.flatMap((pass) => request.tests.map((test) => RunService.newTestRecord(test, pass)));

        this._activeRuns.set(request.runId, runEntry);
        this._onActiveRunsChanged.fire(this._activeRuns.size);

        try {
            await fs.mkdir(runFolder, { recursive: true });

            const iterationsText = passes[0]?.number > 0 ? `, ${passes.length} iteration(s)` : '';
            log(`Starting run ${runTitle}: ${request.tests.length} plan item(s)${iterationsText} on ${engine}` +
                `${request.environment ? `, environment '${request.environment}'` : ''}.`, 'info');

            await this.updateEnvironment(client, request.environment, log);

            // Run the passes one after another: the next iteration starts only after every item of the
            // current one finished, so the whole suite runs once per iteration, in plan order.
            const context: TestContext = { client, manifest, runFolder, runEntry, usedReportNames, log };

            for (const pass of passes) {
                if (runEntry.canceled) {
                    break;
                }

                if (pass.number > 0) {
                    log(`Iteration ${pass.number} (${passes.indexOf(pass) + 1} of ${passes.length}).`, 'info');
                }

                const passRecords = records.filter((record) => (record.iteration ?? 0) === pass.number);

                await this.invokeRecords(request, passRecords, context);
            }

            // Bots never started because of Stop are recorded as canceled, and reported like any other result,
            // so their rows show the reason and the console has a line for each.
            for (const record of records.filter((candidate) => candidate.status === 'queued')) {
                record.status = 'canceled';
                record.message = 'Canceled before it started.';

                this._onRunEvent.fire({
                    runId: request.runId,
                    type: 'result',
                    id: record.key,
                    iteration: record.iteration,
                    outcome: record.status,
                    text: record.message
                });
                log(`${RunService.getStatusText(record.status)} ${RunService.getRecordLabel(record)} - ${record.message}`,
                    RunService.getLogKind(record.status));
            }

            const finishedAt = new Date();
            const tally = RunService.newTally(records);
            const runRecord: RunRecord = {
                type: 'g4-test-wright-run',
                version: 1,
                name: runName,
                label: request.label ?? '',
                scheduled: request.scheduled === true,
                startedAt: startedAt.toISOString(),
                finishedAt: finishedAt.toISOString(),
                duration: finishedAt.getTime() - startedAt.getTime(),
                environment: request.environment,
                engine,
                botsFolder: request.folderPath,
                parallel: request.parallel,
                iterations: passes[0]?.number > 0 ? passes.length : 0,
                status: RunService.getRunStatus(tally),
                tally,
                tests: records
            };
            const runFile = path.join(runFolder, 'run.json');

            await fs.writeFile(runFile, JSON.stringify(runRecord, null, 4), 'utf8');

            if (request.collectAllure) {
                await this.writeAllureResults(runFolder, log);
            }

            const seconds = (runRecord.duration / 1000).toFixed(2);
            // Canceled bots did not pass, so a run with cancellations is not shown as a clean pass.
            const kind = tally.failed + tally.broken > 0 ? 'fail' : (tally.warning + tally.canceled > 0 ? 'warn' : 'pass');

            log(`Run ${runTitle} finished in ${seconds}s: ${tally.passed} passed, ${tally.failed} failed, ` +
                `${tally.warning} warning, ${tally.broken} broken, ${tally.canceled} canceled.`, kind);
            log(`Report: ${runFile}`, 'muted');

            if (runEntry.canceled) {
                log(`Run ${runTitle} canceled.`, 'warn');
            }

            return {
                runId: request.runId,
                tally,
                totalTime: runRecord.duration,
                failed: tally.failed + tally.broken > 0,
                canceled: runEntry.canceled,
                runFolder,
                runFile
            };
        } catch (error: any) {
            this._logger.error(`Run ${runTitle} failed.`, undefined, error);
            log(`Run ${runTitle} failed: ${error?.message ?? error}`, 'fail');

            return {
                runId: request.runId,
                tally: RunService.newTally(records),
                totalTime: Date.now() - startedAt.getTime(),
                failed: true,
                canceled: runEntry.canceled,
                runFolder,
                runFile: ''
            };
        } finally {
            this._activeRuns.delete(request.runId);
            this._activeRunFolders.delete(runFolder);
            this._onActiveRunsChanged.fire(this._activeRuns.size);
        }
    }

    /**
     * Stops a run: in-flight requests are aborted and unstarted bots are skipped.
     *
     * @param runId - The run to stop.
     * @returns True when the run was active.
     */
    public stopRun(runId: number): boolean {
        const runEntry = this._activeRuns.get(runId);

        if (runEntry === undefined) {
            return false;
        }

        runEntry.canceled = true;
        runEntry.controllers.forEach((controller) => controller.abort());

        return true;
    }

    // Picks the run folder: named after the start time, one millisecond later while that name is
    // taken. Scheduled runs due in the same minute start within the same millisecond, and would
    // otherwise write into one folder. Synchronous, so no other run can claim the name meanwhile.
    private newRunFolder(startedAt: Date): { runName: string; runFolder: string } {
        const reportsFolder = Utilities.getReportsFolder() || path.join(os.tmpdir(), 'g4-test-wright', 'reports');
        let time = startedAt.getTime();
        let runName = Utilities.newRunName(startedAt);
        let runFolder = path.join(reportsFolder, runName);

        while (this._activeRunFolders.has(runFolder) || existsSync(runFolder)) {
            time += 1;
            runName = Utilities.newRunName(new Date(time));
            runFolder = path.join(reportsFolder, runName);
        }

        this._activeRunFolders.add(runFolder);

        return { runName, runFolder };
    }

    // Runs the records of one pass with a worker pool: one worker for a sequential run, one per CPU
    // (at most one per record) for a parallel run. Stop ends the pool; unstarted records stay queued.
    private async invokeRecords(request: RunRequest, records: TestRecord[], context: TestContext): Promise<void> {
        const workerCount = request.parallel ? Math.max(1, Math.min(os.availableParallelism(), records.length)) : 1;
        let nextIndex = 0;

        // Each worker takes the next record until none is left or the run was stopped.
        const runWorker = async (): Promise<void> => {
            while (nextIndex < records.length && !context.runEntry.canceled) {
                const record = records[nextIndex++];

                await this.invokeTest(request, record, context);
            }
        };

        await Promise.all(Array.from({ length: workerCount }, runWorker));
    }

    // Runs one plan item in one pass and fills its record.
    private async invokeTest(request: RunRequest, record: TestRecord, context: TestContext): Promise<void> {
        const controller = new AbortController();
        const recordLabel = RunService.getRecordLabel(record);

        // Mark the record as running and tell the page which plan item (and iteration) started.
        context.runEntry.controllers.add(controller);
        record.status = 'running';
        record.start = Date.now();
        this._onRunEvent.fire({ runId: request.runId, type: 'start', id: record.key, iteration: record.iteration });
        context.log(`RUN   ${recordLabel}`, 'muted');

        try {
            let bot: any;

            try {
                bot = await JsonReader.readFile(record.path);
            } catch (error: any) {
                record.status = 'broken';
                record.message = `The bot file cannot be read: ${error?.message ?? error}`;

                return;
            }

            const automation = BotRequestBuilder.newRequest(bot, context.manifest, request.environment);

            // Send this iteration's row of the item; the bot's current columns decide what is sent,
            // and a static bot keeps its request unchanged. The record keeps the row actually sent.
            if (record.values !== undefined) {
                record.values = DataSetService.setDataSource(automation, bot, record.values);
            }

            const result = await context.client.invokeAutomation(automation, controller.signal);

            if (result.aborted) {
                record.status = 'canceled';
                record.message = 'Canceled while running.';

                return;
            }

            if (!result.ok) {
                record.status = 'broken';
                record.message = result.error ?? 'The engine call failed.';

                return;
            }

            // Save the response in the G4 Studio report format (Base64 of the JSON).
            record.reportFile = RunService.newReportFileName(record, context.usedReportNames);
            await fs.writeFile(path.join(context.runFolder, record.reportFile), Utilities.convertToBase64(JSON.stringify(result.data)), 'utf8');

            const evaluation = ResultEvaluator.evaluate(result.data);

            record.status = evaluation.status;
            record.message = evaluation.message;
            record.assertions = evaluation.assertions;
            record.exceptions = evaluation.exceptions;
        } catch (error: any) {
            // One bot's failure (for example its report cannot be written) never ends the run.
            this._logger.error(`Bot ${recordLabel} failed.`, undefined, error);
            record.status = 'broken';
            record.message = `The engine answered, but the result could not be saved or evaluated: ${error?.message ?? error}`;
        } finally {
            record.stop = Date.now();
            record.duration = record.stop - record.start;
            context.runEntry.controllers.delete(controller);

            const seconds = (record.duration / 1000).toFixed(2);
            const label = RunService.getStatusText(record.status);
            const message = record.message ? ` - ${record.message}` : '';

            // Report the result against the plan item and iteration, so duplicates of a bot stay apart.
            this._onRunEvent.fire({
                runId: request.runId,
                type: 'result',
                id: record.key,
                iteration: record.iteration,
                outcome: record.status,
                text: record.message
            });
            context.log(`${label} ${recordLabel} (${seconds}s)${message}`, RunService.getLogKind(record.status));
        }
    }

    // Pushes the selected environment file to the engine so defaultEnvironment resolves.
    private async updateEnvironment(client: G4Client, environment: string, log: (text: string, kind?: string) => void): Promise<void> {
        if (environment === '') {
            return;
        }

        if (!BotsDiscoveryService.testEnvironmentName(environment)) {
            log(`Environment '${environment}' was not synced: the engine accepts only letters, digits, and _ in environment names. Rename the file.`, 'warn');

            return;
        }

        const parameters = await BotsDiscoveryService.readEnvironment(Utilities.getEnvironmentsFolder(), environment);

        if (parameters === null) {
            log(`Environment '${environment}' cannot be read; the engine copy (if any) is used.`, 'warn');

            return;
        }

        const error = await client.updateEnvironment(environment, parameters);

        if (error !== null) {
            log(`Environment '${environment}' was not synced to the engine: ${error}`, 'warn');
        }
    }

    // Converts the run into Allure results (allure-<run>/results) without failing the run on errors.
    private async writeAllureResults(runFolder: string, log: (text: string, kind?: string) => void): Promise<void> {
        try {
            const { resultsFolder, count } = await AllureConverter.convertRun(runFolder);

            log(`Allure results written: ${resultsFolder} (${count} result(s)).`, 'muted');
        } catch (error: any) {
            this._logger.error('Allure conversion failed.', undefined, error);
            log(`Allure conversion failed: ${error?.message ?? error}`, 'warn');
        }
    }

    // Writes one run console line to the G4 Test Wright output channel: failed and broken bots as warnings (a failed
    // bot is a test outcome, not an extension error), everything else as information.
    private writeRunLog(text: string, kind: string): void {
        const isProblem = kind === 'fail' || kind === 'warn';

        if (isProblem) {
            this._logger.warning(text);
            return;
        }

        this._logger.information(text);
    }

    // Overall run status: the worst bot status.
    private static getRunStatus(tally: RunTally): TestStatus {
        if (tally.failed > 0) {
            return 'failed';
        }

        if (tally.broken > 0) {
            return 'broken';
        }

        if (tally.warning > 0) {
            return 'warning';
        }

        if (tally.canceled > 0 && tally.passed === 0) {
            return 'canceled';
        }

        return 'passed';
    }

    // Console kind for a bot status.
    private static getLogKind(status: TestStatus): string {
        switch (status) {
            case 'passed':
                return 'pass';
            case 'failed':
            case 'broken':
                return 'fail';
            default:
                return 'warn';
        }
    }

    // Fixed-width status word for console lines.
    private static getStatusText(status: TestStatus): string {
        return status.toUpperCase().padEnd(8, ' ');
    }

    // Returns the passes of a run: one per included iteration, numbered like the editor rows, or one
    // pass without data (number 0) when the plan has no iterations. A plan whose iterations are all
    // excluded has no pass, so nothing runs.
    private static getPasses(request: RunRequest): RunPass[] {
        const iterations = request.iterations ?? [];

        if (iterations.length === 0) {
            return [{ number: 0, index: -1 }];
        }

        return iterations
            .map((iteration, index) => ({ isIncluded: iteration?.include !== false, pass: { number: index + 1, index } }))
            .filter((candidate) => candidate.isIncluded)
            .map((candidate) => candidate.pass);
    }

    // Names a record in console lines: the bot id, its plan position, and its iteration, so
    // duplicate items of the same bot can be told apart ('smoke/login.json #4, iteration 2').
    private static getRecordLabel(record: TestRecord): string {
        const positionText = record.position ? ` #${record.position}` : '';
        const iterationText = record.iteration ? `, iteration ${record.iteration}` : '';

        return `${record.id}${positionText}${iterationText}`;
    }

    // Names a run in console lines: the run folder name, then "(scheduled run 'label')" for a labeled
    // scheduled run, "(scheduled run)" for an unlabeled one, and nothing more for a manual run.
    private static getRunTitle(runName: string, request: RunRequest): string {
        // A manual run is named by its folder alone.
        if (request.scheduled !== true) {
            return runName;
        }

        // Mark a scheduled run, and add its label when the user gave one.
        const label = request.label?.trim() ?? '';
        const labelText = label === '' ? '' : ` '${label}'`;

        return `${runName} (scheduled run${labelText})`;
    }

    // Builds a unique report file name from the bot id, plan position, and iteration:
    // 'smoke/login.json' at #4 in iteration 2 -> 'smoke.login.p4.i2.g4rpt'.
    private static newReportFileName(record: TestRecord, usedNames: Set<string>): string {
        const botName = record.id.replace(/\.(json|g4|g4bot)$/i, '').split('/').join('.');
        const positionText = record.position ? `.p${record.position}` : '';
        const iterationText = record.iteration ? `.i${record.iteration}` : '';
        const baseName = Utilities.newSafeFileName(`${botName}${positionText}${iterationText}`);
        let fileName = `${baseName}.g4rpt`;
        let counter = 2;

        while (usedNames.has(fileName.toLowerCase())) {
            fileName = `${baseName}-${counter++}.g4rpt`;
        }

        usedNames.add(fileName.toLowerCase());

        return fileName;
    }

    // Counts records per status.
    private static newTally(records: TestRecord[]): RunTally {
        const tally: RunTally = { total: records.length, passed: 0, failed: 0, warning: 0, broken: 0, canceled: 0 };

        for (const record of records) {
            if (record.status in tally) {
                (tally as any)[record.status] += 1;
            }
        }

        return tally;
    }

    // Starts the record of one plan item in one pass, in the queued state. The pass picks the item's
    // row: the row at the iteration's index, or none for a pass without data.
    private static newTestRecord(test: RunTest, pass: RunPass): TestRecord {
        const key = test.key || test.id;
        const values = pass.index >= 0 ? test.data?.[pass.index] : undefined;
        const runKey = pass.number > 0 ? `${key}@${pass.number}` : key;

        return {
            runKey,
            key,
            position: test.position,
            iteration: pass.number,
            values,
            id: test.id,
            name: test.name,
            file: test.id,
            path: test.path,
            suite: test.suite,
            tags: test.tags,
            status: 'queued',
            start: 0,
            stop: 0,
            duration: 0,
            reportFile: '',
            message: '',
            assertions: { total: 0, failed: 0 },
            exceptions: 0
        };
    }
}

// Compile-time contracts stay after the executable code, interfaces precede type aliases, and
// local dependency chains take priority over A-Z sorting.

/**
 * One pass of a run: the whole suite runs once per pass.
 */
interface RunPass {
    /** One-based iteration number, as the editor shows it; 0 for a run without iterations. */
    number: number;

    /** Index of the iteration in the plan, which picks each item's row; -1 for a run without iterations. */
    index: number;
}

/**
 * Values shared by the bots of one run.
 */
interface TestContext {
    client: G4Client;
    manifest: any;
    runFolder: string;
    runEntry: { controllers: Set<AbortController>; canceled: boolean };
    usedReportNames: Set<string>;
    log: (text: string, kind?: string) => void;
}
