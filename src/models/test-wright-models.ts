/*
 * Shared contracts between the Test Wright extension host and its webview pages.
 *
 * The webview talks to the host through request/response messages (see TestWrightPanelProvider);
 * every payload and result that crosses that boundary is declared here so both sides agree.
 */

/**
 * Status of one bot (test) in the tree, the plan, and the run record.
 *
 * - not-run: never ran in this plan row.
 * - queued / running: live run states.
 * - passed: no failed assertion and no exception.
 * - failed: at least one Assert evaluated to false.
 * - warning: exceptions were reported, but no assertion failed (Allure: broken).
 * - broken: the bot could not run (engine unreachable, HTTP error, invalid bot file).
 * - canceled: the run was stopped before the bot finished.
 */
export type TestStatus = 'not-run' | 'queued' | 'running' | 'passed' | 'failed' | 'warning' | 'broken' | 'canceled';

/**
 * One discovered bot file: a test. Its folder below the bots root is its suite.
 */
export interface BotTest {
    /** Stable id: the path relative to the bots root, with forward slashes (for example 'smoke/login.json'). */
    id: string;

    /** Display name: the file name without its extension. */
    name: string;

    /** Same as id; kept as a separate field because the tree groups by it. */
    file: string;

    /** Absolute file path. */
    path: string;

    /** Suite: the folder below the bots root (empty for bots at the root). */
    suite: string;

    /** Tags read from the bot's reference.tags array. */
    tags: string[];
}

/**
 * Result of a discovery request.
 */
export interface DiscoveryResult {
    /** The bots root that was scanned. */
    folderPath: string;

    /** Discovered bots, sorted by id. */
    tests: BotTest[];

    /** Files that were skipped, with the reason (invalid JSON, not a bot). */
    warnings: string[];

    /** Set when the folder could not be scanned at all. */
    error?: string;
}

/**
 * One environment file under the workspace environments folder.
 */
export interface EnvironmentEntry {
    /** Environment name: the file name without its extension. */
    name: string;

    /** Absolute file path. */
    path: string;

    /** Number of parameters in the file (shown in the picker). */
    parameterCount: number;

    /** Why the engine cannot use this environment (the picker shows it and disables the entry); empty when usable. */
    issue: string;
}

/**
 * Request to run a set of bots.
 */
export interface RunRequest {
    /** Correlates streamed events with this run. */
    runId: number;

    /** Bots to run, unique by id. */
    tests: { id: string; path: string; name: string; suite: string; tags: string[] }[];

    /** The bots root the ids are relative to. */
    folderPath: string;

    /** Selected environment name, or empty for none. */
    environment: string;

    /** Run bots concurrently. */
    parallel: boolean;

    /** Write Allure results for this run. */
    collectAllure: boolean;

    /** Scheduled-run label, for the record and the logs. */
    label?: string;

    /** True when a schedule started the run. */
    scheduled?: boolean;
}

/**
 * Live event streamed from the host while a run is in flight.
 */
export interface RunEvent {
    /** The run the event belongs to. */
    runId: number;

    /** start: a bot began; result: a bot finished; log: a console line. */
    type: 'start' | 'result' | 'log';

    /** Bot id for start and result events. */
    id?: string;

    /** Final status for result events. */
    outcome?: TestStatus;

    /** Text for log events, or the result message. */
    text?: string;

    /** Console line kind for log events: info, pass, fail, warn, muted. */
    kind?: string;
}

/**
 * Counts per status for a run.
 */
export interface RunTally {
    total: number;
    passed: number;
    failed: number;
    warning: number;
    broken: number;
    canceled: number;
}

/**
 * Summary returned when a run finishes.
 */
export interface RunSummary {
    runId: number;
    tally: RunTally;
    totalTime: number;
    failed: boolean;
    canceled: boolean;

    /** The run folder (reports/<run name>). */
    runFolder: string;

    /** The run.json path. */
    runFile: string;
}

/**
 * One bot entry in a run record (run.json).
 */
export interface TestRecord {
    id: string;
    name: string;
    file: string;
    path: string;
    suite: string;
    tags: string[];
    status: TestStatus;

    /** Epoch milliseconds. */
    start: number;

    /** Epoch milliseconds. */
    stop: number;

    /** Milliseconds. */
    duration: number;

    /** Report file name inside the run folder, or empty when no response was received. */
    reportFile: string;

    /** Short reason: the first failed assertion, first exception, or the transport error. */
    message: string;

    /** Assertion counts. */
    assertions: { total: number; failed: number };

    /** Number of plugin and session exceptions. */
    exceptions: number;
}

/**
 * The run record saved as run.json in each run folder.
 */
export interface RunRecord {
    type: 'g4-test-wright-run';
    version: 1;

    /** Run folder name (yyyy-MM-dd-HHmmssfff). */
    name: string;
    label: string;
    scheduled: boolean;
    startedAt: string;
    finishedAt: string;

    /** Milliseconds. */
    duration: number;
    environment: string;
    engine: string;
    botsFolder: string;
    parallel: boolean;
    status: TestStatus;
    tally: RunTally;
    tests: TestRecord[];
}

/**
 * One row in the reports repository list.
 */
export interface ReportSummary {
    path: string;
    relativePath: string;
    fileName: string;
    name: string;
    label: string;

    /** Epoch milliseconds the run started. */
    modifiedAt: number;
    status: TestStatus;
    tally: RunTally;
    hasAllure: boolean;
}

/**
 * One item of a saved plan file.
 */
export interface PlanFileItem {
    testId: string;
    name: string;
    file: string;
    suite: string;
    tags: string[];
    checked: boolean;
    folder: string;
}

/**
 * A saved plan file (g4-test-wright-plan).
 */
export interface PlanFile {
    type: 'g4-test-wright-plan';
    version: 1;
    savedAt: string;
    folderPath: string;
    parallel: boolean;
    items: PlanFileItem[];
}

/**
 * One row in the plans repository list.
 */
export interface PlanSummary {
    path: string;
    relativePath: string;
    fileName: string;
    itemCount: number;
    savedAt: string;
}

/**
 * A timed run kept by the host scheduler.
 */
export interface ScheduleEntry {
    id: number;

    /** ISO date-time. */
    runAt: string;
    label: string;
    items: PlanFileItem[];
    testParallel: boolean;
    environment: string;
    folderPath: string;
    collectAllure: boolean;
}
