/*
 * File-backed repositories: saved plans (g4-test-wright-plan JSON) and run reports (run.json).
 */
import * as fs from 'node:fs/promises';
import * as path from 'node:path';
import { AllureConverter } from './allure-converter';
import { JsonReader } from '../extensions/json-reader';
import { PlanFile, PlanSummary, ReportSummary, RunRecord } from '../models/test-wright-models';

// Plan file type marker.
const PLAN_FILE_TYPE = 'g4-test-wright-plan';

// Run record type marker.
const RUN_FILE_TYPE = 'g4-test-wright-run';

// Recursion limit for repository scans, so a misplaced root (a drive) cannot walk forever.
const MAXIMUM_SCAN_DEPTH = 6;

/**
 * Lists, reads, and writes plan files and run records.
 */
export class RepositoryService {
    /**
     * Lists the valid plan files under a folder, newest first.
     *
     * @param folderPath - The plans repository folder.
     * @returns The plan summaries.
     */
    public static async listPlans(folderPath: string): Promise<PlanSummary[]> {
        const files = await RepositoryService.findFiles(folderPath, (name) => name.toLowerCase().endsWith('.json'), 0);
        const plans: PlanSummary[] = [];

        for (const filePath of files) {
            const plan = await RepositoryService.readPlan(filePath);

            if (plan !== null) {
                plans.push({
                    path: filePath,
                    relativePath: path.relative(folderPath, filePath).split(path.sep).join('/'),
                    fileName: path.basename(filePath),
                    itemCount: plan.items.length,
                    savedAt: plan.savedAt ?? ''
                });
            }
        }

        return plans.sort((left, right) => `${right.savedAt}`.localeCompare(`${left.savedAt}`));
    }

    /**
     * Lists the run records under a folder, newest first.
     *
     * @param folderPath - The reports folder (holds one folder per run).
     * @returns The report summaries.
     */
    public static async listReports(folderPath: string): Promise<ReportSummary[]> {
        const files = await RepositoryService.findFiles(folderPath, (name) => name.toLowerCase() === 'run.json', 0);
        const reports: ReportSummary[] = [];

        for (const filePath of files) {
            const record = await RepositoryService.readRun(filePath);

            if (record === null) {
                continue;
            }

            const runFolder = path.dirname(filePath);
            const hasAllure = await RepositoryService.testFolder(AllureConverter.getResultsFolder(runFolder))
                || await RepositoryService.testFolder(path.join(runFolder, 'allure-results'));

            reports.push({
                path: filePath,
                relativePath: path.relative(folderPath, filePath).split(path.sep).join('/'),
                fileName: path.basename(runFolder),
                name: record.name,
                label: record.label ?? '',
                modifiedAt: Date.parse(record.startedAt) || 0,
                status: record.status,
                tally: record.tally,
                hasAllure
            });
        }

        return reports.sort((left, right) => right.modifiedAt - left.modifiedAt);
    }

    /**
     * Reads a plan file.
     *
     * @param filePath - The plan file.
     * @returns The plan, or null when the file is missing or not a plan.
     */
    public static async readPlan(filePath: string): Promise<PlanFile | null> {
        try {
            const plan = await JsonReader.readFile(filePath);
            const isPlan = plan?.type === PLAN_FILE_TYPE && Array.isArray(plan.items);

            return isPlan ? plan : null;
        } catch {
            return null;
        }
    }

    /**
     * Reads a run record.
     *
     * @param filePath - The run.json file.
     * @returns The record, or null when the file is missing or not a run record.
     */
    public static async readRun(filePath: string): Promise<RunRecord | null> {
        try {
            const record = await JsonReader.readFile(filePath);
            const isRecord = record?.type === RUN_FILE_TYPE && Array.isArray(record.tests);

            return isRecord ? record : null;
        } catch {
            return null;
        }
    }

    /**
     * Writes a plan file, creating its folder.
     *
     * @param filePath - Target file.
     * @param plan - The plan.
     */
    public static async writePlan(filePath: string, plan: PlanFile): Promise<void> {
        await fs.mkdir(path.dirname(filePath), { recursive: true });
        await fs.writeFile(filePath, JSON.stringify(plan, null, 4), 'utf8');
    }

    // Finds files whose name matches, recursively, skipping node_modules and Allure output.
    private static async findFiles(folderPath: string, isMatch: (name: string) => boolean, depth: number): Promise<string[]> {
        if (depth > MAXIMUM_SCAN_DEPTH) {
            return [];
        }

        let entries;

        try {
            entries = await fs.readdir(folderPath, { withFileTypes: true });
        } catch {
            return [];
        }

        const files: string[] = [];

        for (const entry of entries) {
            const entryPath = path.join(folderPath, entry.name);

            if (entry.isDirectory()) {
                const isSkipped = entry.name === 'node_modules' || entry.name.startsWith('allure-');

                if (!isSkipped) {
                    files.push(...await RepositoryService.findFiles(entryPath, isMatch, depth + 1));
                }
            } else if (entry.isFile() && isMatch(entry.name)) {
                files.push(entryPath);
            }
        }

        return files;
    }

    // True when a folder exists.
    private static async testFolder(folderPath: string): Promise<boolean> {
        try {
            return (await fs.stat(folderPath)).isDirectory();
        } catch {
            return false;
        }
    }
}
