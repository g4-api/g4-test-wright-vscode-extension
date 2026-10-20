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
 *
 * @remarks
 * Every plan item runs on its own, in plan order, even when several items point at the same bot.
 * When the plan has iterations, the whole suite runs once per included iteration: iteration 1 runs
 * every item, then iteration 2 runs every item again with the next row of each item's data.
 */
export interface RunRequest {
    /** Correlates streamed events with this run. */
    runId: number;

    /** Plan items to run, in plan order; several items may point at the same bot. */
    tests: RunTest[];

    /**
     * The plan's iterations, included or not; empty or absent runs the suite once, and each bot then
     * uses its own data source (if any).
     */
    iterations?: PlanIteration[];

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
 * One plan item of a run request.
 */
export interface RunTest {
    /** Plan item key: identifies this item among items that point at the same bot. */
    key: string;

    /** Bot id (path relative to the bots root, forward slashes). */
    id: string;

    /** Absolute bot file path. */
    path: string;

    /** Display name of the bot. */
    name: string;

    /** Suite of the bot (its folder below the bots root). */
    suite: string;

    /** Tags of the bot. */
    tags: string[];

    /** One-based position of the item in the plan, shown as "#n" so duplicate items stay apart. */
    position: number;

    /**
     * The item's data rows, one per plan iteration (column name to value); empty for a static bot,
     * which has no {{$ columns.Name }} placeholders and runs unchanged in every iteration.
     */
    data?: Record<string, string>[];
}

/**
 * Live event streamed from the host while a run is in flight.
 */
export interface RunEvent {
    /** The run the event belongs to. */
    runId: number;

    /** start: a bot began; result: a bot finished; log: a console line. */
    type: 'start' | 'result' | 'log';

    /** Plan item key for start and result events. */
    id?: string;

    /** One-based iteration of start and result events; 0 when the plan has no iterations. */
    iteration?: number;

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
 * One bot execution in a run record (run.json): one plan item in one iteration.
 */
export interface TestRecord {
    /** Unique execution key: the plan item key, plus "@<iteration>" when the plan has iterations. */
    runKey?: string;

    /** Plan item key (absent in records written before plan items had keys). */
    key?: string;

    /** One-based plan position of the item (absent in older records). */
    position?: number;

    /** One-based iteration; 0 or absent when the plan had no iterations. */
    iteration?: number;

    /** The data row sent with this execution (column name to value); absent for static bots. */
    values?: Record<string, string>;

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

    /** Number of iterations the run went through; 0 or absent when the plan had none. */
    iterations?: number;
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
    /** Stable plan item key (absent in version 1 plans; the page then creates one). */
    key?: string;
    testId: string;
    name: string;
    file: string;
    suite: string;
    tags: string[];
    checked: boolean;
    folder: string;

    /** The item's data rows, one per plan iteration; absent or empty for a static bot. */
    data?: Record<string, string>[];
}

/**
 * One iteration of a plan: the whole suite runs once per included iteration.
 */
export interface PlanIteration {
    /** False skips this iteration for every bot, so all tables stay in step. */
    include: boolean;
}

/**
 * A saved plan file (g4-test-wright-plan).
 *
 * @remarks
 * Version 2 adds item keys, per-item data rows, and the plan iterations; version 1 plans load as
 * plans without iterations.
 */
export interface PlanFile {
    type: 'g4-test-wright-plan';
    version: 1 | 2;
    savedAt: string;
    folderPath: string;
    parallel: boolean;

    /** The plan iterations (version 2); absent or empty runs the suite once. */
    iterations?: PlanIteration[];
    items: PlanFileItem[];
}

/**
 * Data columns and starting rows of one bot, read for the iterations editor.
 */
export interface BotDataDescription {
    /** Column names from the bot's {{$ columns.Name }} placeholders, in order of first use. */
    columns: string[];

    /** Rows of the bot's own data source, as text, used to fill new cells; empty when it has none. */
    rows: Record<string, string>[];

    /** Why the bot or its data source could not be read; empty when it was read. */
    error: string;
}

/**
 * A data file exported from the iterations editor (g4-test-wright-data).
 */
export interface DataFile {
    type: 'g4-test-wright-data';
    version: 1;
    savedAt: string;

    /** One entry per plan iteration. */
    iterations: DataFileIteration[];
}

/**
 * One iteration of a data file.
 */
export interface DataFileIteration {
    /** Whether the iteration runs. */
    include: boolean;

    /** Values of each plan item in this iteration, by plan item key. */
    items: Record<string, DataFileItem>;
}

/**
 * The values of one plan item in one iteration of a data file.
 */
export interface DataFileItem {
    /** One-based plan position, used to match items when the keys differ (another plan). */
    position: number;

    /** Bot id, used with the position to match items when the keys differ. */
    testId: string;

    /** Column name to value. */
    values: Record<string, string>;
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

    /** The plan iterations when the run was scheduled; absent or empty runs the suite once. */
    iterations?: PlanIteration[];
    testParallel: boolean;
    environment: string;
    folderPath: string;
    collectAllure: boolean;
}
