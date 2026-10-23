/*
 * Timed runs (up to five), kept by the extension host so closing the Test Wright panel does not
 * cancel them. Schedules persist in the workspace state; past-due schedules are dropped on load.
 *
 * When a schedule is due it starts at once if Parallel Runs is on or nothing else is running;
 * otherwise it waits in a queue and starts when the active run count drops to zero.
 */
import * as path from 'node:path';
import * as vscode from 'vscode';
import { Logger } from '../logging/logger';
import { RunService } from './run-service';
import { RunSummary, ScheduleEntry } from '../models/test-wright-models';

// Most schedules kept at once (same cap as the desktop Test Wright).
export const MAXIMUM_SCHEDULES = 5;

// setTimeout cannot wait longer than 2^31-1 ms; longer delays are re-armed in steps.
const MAXIMUM_TIMER_MILLISECONDS = 2_147_483_647;

// Workspace state keys.
const SCHEDULES_STATE_KEY = 'g4TestWright.schedules';
const PARALLEL_STATE_KEY = 'g4TestWright.scheduleParallel';

// Scheduled run ids start high so they never collide with the panel's own run ids.
const SCHEDULED_RUN_ID_BASE = 1_000_000;

/**
 * Keeps, arms, and fires scheduled runs.
 */
export class SchedulerService implements vscode.Disposable {
    // Fires when the schedule list or the parallel mode changes.
    private readonly _onDidChange = new vscode.EventEmitter<void>();

    // Fires when a scheduled run finishes.
    private readonly _onDidFinishRun = new vscode.EventEmitter<RunSummary>();

    // Armed timers by schedule id.
    private readonly _timers = new Map<number, NodeJS.Timeout>();

    // Due schedules waiting for a free slot.
    private readonly _queue: ScheduleEntry[] = [];

    // Workspace state owner.
    private readonly _context: vscode.ExtensionContext;

    // Executes the runs.
    private readonly _runService: RunService;

    // Named logger.
    private readonly _logger: Logger;

    // Subscription to active run changes (drains the queue).
    private readonly _activeRunsSubscription: vscode.Disposable;

    // Current schedules.
    private _schedules: ScheduleEntry[] = [];

    // Next scheduled run id.
    private _nextRunId = SCHEDULED_RUN_ID_BASE;

    /**
     * Creates the scheduler and re-arms the persisted schedules.
     *
     * @param context - The extension context (workspace state).
     * @param runService - Executes the runs.
     * @param logger - Parent logger.
     */
    constructor(context: vscode.ExtensionContext, runService: RunService, logger: Logger) {
        this._context = context;
        this._runService = runService;
        this._logger = logger.newLogger('G4.TestWright.Scheduler');
        this._activeRunsSubscription = runService.onActiveRunsChanged((count) => {
            if (count === 0) {
                this.startQueued();
            }
        });

        this.loadSchedules();
    }

    /** Fires when schedules or the parallel mode change. */
    public readonly onDidChange = this._onDidChange.event;

    /** Fires when a scheduled run finishes. */
    public readonly onDidFinishRun = this._onDidFinishRun.event;

    /** Whether due runs start in parallel (true) or queue (false). */
    public get isParallel(): boolean {
        return this._context.workspaceState.get<boolean>(PARALLEL_STATE_KEY, false);
    }

    /** The schedules, soonest first. */
    public get schedules(): ScheduleEntry[] {
        return [...this._schedules].sort((left, right) => Date.parse(left.runAt) - Date.parse(right.runAt));
    }

    /**
     * Adds a schedule.
     *
     * @param entry - The schedule without its id.
     * @returns Null on success, or the reason it was refused.
     */
    public addSchedule(entry: Omit<ScheduleEntry, 'id'>): string | null {
        if (this._schedules.length >= MAXIMUM_SCHEDULES) {
            return `At most ${MAXIMUM_SCHEDULES} runs can be scheduled.`;
        }

        if (!(Date.parse(entry.runAt) > Date.now())) {
            return 'The scheduled time must be in the future.';
        }

        if (entry.items.length === 0) {
            return 'The plan has no checked items.';
        }

        const id = this._schedules.reduce((maximum, schedule) => Math.max(maximum, schedule.id), 0) + 1;
        const schedule: ScheduleEntry = { ...entry, id };

        this._schedules.push(schedule);
        this.armSchedule(schedule);
        this.saveSchedules();

        return null;
    }

    /**
     * Releases timers and event emitters.
     */
    public dispose(): void {
        this._timers.forEach((timer) => clearTimeout(timer));
        this._timers.clear();
        this._activeRunsSubscription.dispose();
        this._onDidChange.dispose();
        this._onDidFinishRun.dispose();
    }

    /**
     * Cancels and removes a schedule.
     *
     * @param id - The schedule id.
     */
    public removeSchedule(id: number): void {
        clearTimeout(this._timers.get(id));
        this._timers.delete(id);
        this._schedules = this._schedules.filter((schedule) => schedule.id !== id);
        this.saveSchedules();
    }

    /**
     * Sets whether due runs start in parallel or queue.
     *
     * @param isParallel - True to start due runs at once.
     */
    public async setParallel(isParallel: boolean): Promise<void> {
        await this._context.workspaceState.update(PARALLEL_STATE_KEY, isParallel);
        this._onDidChange.fire();
    }

    /**
     * Renames a schedule.
     *
     * @param id - The schedule id.
     * @param label - The new label.
     */
    public setLabel(id: number, label: string): void {
        const schedule = this._schedules.find((candidate) => candidate.id === id);

        // Saving notifies every Test Wright tab, so the others show the new label too.
        if (schedule !== undefined) {
            schedule.label = label;
            this.saveSchedules();
        }
    }

    // Arms one schedule; long delays re-arm in steps.
    private armSchedule(schedule: ScheduleEntry): void {
        const delay = Date.parse(schedule.runAt) - Date.now();
        const timer = setTimeout(() => {
            if (Date.parse(schedule.runAt) - Date.now() > 0) {
                this.armSchedule(schedule);
            } else {
                this.invokeSchedule(schedule.id);
            }
        }, Math.min(Math.max(delay, 0), MAXIMUM_TIMER_MILLISECONDS));

        this._timers.set(schedule.id, timer);
    }

    // Fires a due schedule: removes it, then starts or queues its run.
    private invokeSchedule(id: number): void {
        const schedule = this._schedules.find((candidate) => candidate.id === id);

        if (schedule === undefined) {
            return;
        }

        this._timers.delete(id);
        this._schedules = this._schedules.filter((candidate) => candidate.id !== id);
        this.saveSchedules();

        if (this.isParallel || this._runService.activeRunCount === 0) {
            void this.startSchedule(schedule);
        } else {
            this._queue.push(schedule);
            this._logger.information(`Scheduled run '${schedule.label || schedule.runAt}' queued (a run is in progress).`);
        }
    }

    // Loads persisted schedules and arms the future ones.
    private loadSchedules(): void {
        const saved = this._context.workspaceState.get<ScheduleEntry[]>(SCHEDULES_STATE_KEY, []);

        this._schedules = saved
            .filter((schedule) => Date.parse(schedule.runAt) > Date.now())
            .slice(0, MAXIMUM_SCHEDULES);

        const droppedCount = saved.length - this._schedules.length;

        if (droppedCount > 0) {
            this._logger.warning(`${droppedCount} past-due scheduled run(s) dropped.`);
            void this._context.workspaceState.update(SCHEDULES_STATE_KEY, this._schedules);
        }

        this._schedules.forEach((schedule) => this.armSchedule(schedule));
    }

    // Persists the schedules and notifies listeners.
    private saveSchedules(): void {
        void this._context.workspaceState.update(SCHEDULES_STATE_KEY, this._schedules);
        this._onDidChange.fire();
    }

    // Starts the next queued schedule, if any.
    private startQueued(): void {
        const next = this._queue.shift();

        if (next !== undefined) {
            void this.startSchedule(next);
        }
    }

    // Runs one schedule's plan snapshot: every item in its position, with its data, once per
    // included iteration (or once when the snapshot has no iterations).
    private async startSchedule(schedule: ScheduleEntry): Promise<void> {
        const summary = await this._runService.invokeRun({
            runId: this._nextRunId++,
            tests: schedule.items.map((item, index) => ({
                key: item.key || `${item.testId}#${index + 1}`,
                id: item.testId,
                name: item.name,
                suite: item.suite,
                tags: item.tags,
                position: index + 1,
                data: item.data ?? [],
                path: path.join(item.folder || schedule.folderPath, ...item.testId.split('/'))
            })),
            iterations: schedule.iterations ?? [],
            folderPath: schedule.folderPath,
            environment: schedule.environment,
            parallel: schedule.testParallel,
            collectAllure: schedule.collectAllure,
            label: schedule.label,
            scheduled: true
        });

        this._onDidFinishRun.fire(summary);
    }
}
