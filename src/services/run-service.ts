/*
 * Runs bots against the G4 engine and records the run.
 *
 * A run executes its bots one after another, or with a worker pool sized to the CPU count when
 * Parallel Tests is on. Each finished bot is saved as a Base64 .g4rpt (the G4 Studio report format)
 * inside the run folder `<reports>/<yyyy-MM-dd-HHmmssfff>/`, next to run.json. When Allure
 * collection is on, the results go to `<reports>/allure-<run>/results/` beside the run folder.
 */
import * as fs from 'node:fs/promises';
import * as os from 'node:os';
import { existsSync } from 'node:fs';
import * as path from 'node:path';
import * as vscode from 'vscode';
import { AllureConverter } from './allure-converter';
import { BotRequestBuilder } from './bot-request-builder';
import { BotsDiscoveryService } from './bots-discovery-service';
import { G4Client } from '../clients/g4-client';
import { JsonReader } from '../extensions/json-reader';
import { Logger } from '../logging/logger';
import { ResultEvaluator } from './result-evaluator';
import { RunEvent, RunRecord, RunRequest, RunSummary, RunTally, TestRecord, TestStatus } from '../models/test-wright-models';
import { Utilities } from '../extensions/utilities';

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
        const records: TestRecord[] = request.tests.map((test) => RunService.newTestRecord(test));
        const usedReportNames = new Set<string>();
        const log = (text: string, kind = 'muted'): void => this._onRunEvent.fire({ runId: request.runId, type: 'log', text, kind });

        this._activeRuns.set(request.runId, runEntry);
        this._onActiveRunsChanged.fire(this._activeRuns.size);

        try {
            await fs.mkdir(runFolder, { recursive: true });

            const tag = request.scheduled ? ` (scheduled${request.label ? `: ${request.label}` : ''})` : '';
            log(`Starting run ${runName}${tag}: ${records.length} bot(s) on ${engine}${request.environment ? `, environment '${request.environment}'` : ''}.`, 'info');

            await this.updateEnvironment(client, request.environment, log);

            // Sequential runs use one worker; parallel runs use one worker per CPU (at most one per bot).
            const workerCount = request.parallel ? Math.max(1, Math.min(os.availableParallelism(), records.length)) : 1;
            let nextIndex = 0;

            const runWorker = async (): Promise<void> => {
                while (nextIndex < records.length && !runEntry.canceled) {
                    const record = records[nextIndex++];

                    await this.invokeTest(request, record, { client, manifest, runFolder, runEntry, usedReportNames, log });
                }
            };

            await Promise.all(Array.from({ length: workerCount }, runWorker));

            // Bots never started because of Stop are recorded as canceled.
            for (const record of records.filter((candidate) => candidate.status === 'queued')) {
                record.status = 'canceled';
                record.message = 'Canceled before it started.';
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

            log(`Run ${runName} finished in ${seconds}s: ${tally.passed} passed, ${tally.failed} failed, ` +
                `${tally.warning} warning, ${tally.broken} broken, ${tally.canceled} canceled.`, kind);
            log(`Report: ${runFile}`, 'muted');

            if (runEntry.canceled) {
                log('Run canceled.', 'warn');
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
            this._logger.error(`Run ${runName} failed.`, undefined, error);
            log(`Run failed: ${error?.message ?? error}`, 'fail');

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

    // Runs one bot and fills its record.
    private async invokeTest(request: RunRequest, record: TestRecord, context: TestContext): Promise<void> {
        const controller = new AbortController();

        context.runEntry.controllers.add(controller);
        record.status = 'running';
        record.start = Date.now();
        this._onRunEvent.fire({ runId: request.runId, type: 'start', id: record.id });
        context.log(`RUN   ${record.id}`, 'muted');

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
            record.reportFile = RunService.newReportFileName(record.id, context.usedReportNames);
            await fs.writeFile(path.join(context.runFolder, record.reportFile), Utilities.convertToBase64(JSON.stringify(result.data)), 'utf8');

            const evaluation = ResultEvaluator.evaluate(result.data);

            record.status = evaluation.status;
            record.message = evaluation.message;
            record.assertions = evaluation.assertions;
            record.exceptions = evaluation.exceptions;
        } finally {
            record.stop = Date.now();
            record.duration = record.stop - record.start;
            context.runEntry.controllers.delete(controller);

            const seconds = (record.duration / 1000).toFixed(2);
            const label = RunService.getStatusText(record.status);
            const message = record.message ? ` - ${record.message}` : '';

            this._onRunEvent.fire({ runId: request.runId, type: 'result', id: record.id, outcome: record.status, text: record.message });
            context.log(`${label} ${record.id} (${seconds}s)${message}`, RunService.getLogKind(record.status));
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

    // Builds a unique report file name from a bot id: 'smoke/login.json' -> 'smoke.login.g4rpt'.
    private static newReportFileName(id: string, usedNames: Set<string>): string {
        const baseName = Utilities.newSafeFileName(id.replace(/\.(json|g4|g4bot)$/i, '').split('/').join('.'));
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

    // Starts the record of one bot in the queued state.
    private static newTestRecord(test: RunRequest['tests'][number]): TestRecord {
        return {
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

// Compile-time contracts stay after the executable code.

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
