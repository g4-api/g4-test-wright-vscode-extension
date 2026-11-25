/*
 * Tests the Allure steps Test Wright writes for Parallel containers and Input Actions Groups.
 */
import * as assert from 'node:assert/strict';
import * as fs from 'node:fs/promises';
import * as os from 'node:os';
import * as path from 'node:path';
import { AllureConverter } from '../../services/allure-converter';
import { RunRecord, TestRecord } from '../../models/test-wright-models';
import { newInputActionsResponse, newParallelResponse } from './response-fixtures';

/**
 * Builds a run record with one test entry.
 *
 * @param test - The test entry.
 * @returns The run record.
 */
const newRunRecord = (test: TestRecord): RunRecord => ({
    type: 'g4-test-wright-run',
    version: 1,
    name: '20261125-100000',
    label: 'Unit test run',
    scheduled: false,
    startedAt: '2026-11-25T10:00:00Z',
    finishedAt: '2026-11-25T10:00:05Z',
    duration: 5000,
    environment: 'SystemParameters',
    engine: 'http://localhost:9944',
    botsFolder: 'bots',
    parallel: true,
    status: test.status,
    tally: { total: 1, passed: 0, failed: 0, warning: 0, broken: 0, canceled: 0 },
    tests: [test]
});

/**
 * Builds a test entry.
 *
 * @param status - The test status the run service computed.
 * @returns The test entry.
 */
const newTestRecord = (status: TestRecord['status']): TestRecord => ({
    id: 'bots/smoke/login',
    name: 'login',
    file: 'login.json',
    path: 'bots/smoke/login.json',
    suite: 'smoke',
    tags: [],
    status,
    start: 0,
    stop: 0,
    duration: 0,
    reportFile: '',
    message: '',
    assertions: { total: 0, failed: 0 },
    exceptions: 0
});

/**
 * Converts one response and returns the Allure result written for it.
 *
 * @param response - The engine answer.
 * @param status - The test status.
 * @returns The parsed Allure result.
 */
const convertResponse = async (response: any, status: TestRecord['status']): Promise<any> => {
    // Each conversion writes into its own temporary results folder, removed after reading.
    const resultsFolder = await fs.mkdtemp(path.join(os.tmpdir(), 'test-wright-allure-'));

    try {
        const test = newTestRecord(status);
        const uuid = await new AllureConverter(resultsFolder).writeTestResult(newRunRecord(test), test, response);
        const text = await fs.readFile(path.join(resultsFolder, `${uuid}-result.json`), 'utf8');

        return JSON.parse(text);
    } finally {
        await fs.rm(resultsFolder, { recursive: true, force: true });
    }
};

describe('AllureConverter.writeTestResult', () => {
    it('writes one job step per Parallel job and fails only the job with the failed assertion', async () => {
        const result = await convertResponse(newParallelResponse(), 'failed');
        const [firstJob, secondJob] = result.steps;

        assert.equal(result.status, 'failed');
        assert.equal(result.steps.length, 2);
        assert.equal(firstJob.name, 'Job 1');
        assert.equal(firstJob.status, 'passed');
        assert.equal(secondJob.name, 'Job 2');
        assert.equal(secondJob.status, 'failed');
        assert.deepEqual(secondJob.steps.map((step: any) => step.status), ['passed', 'failed']);
    });

    it('nests input actions under their group and marks the group broken by its failed child', async () => {
        const result = await convertResponse(newInputActionsResponse(), 'warning');
        const group = result.steps.find((step: any) => step.name === 'InvokeInputActions');

        assert.equal(result.status, 'broken');
        assert.deepEqual(group.steps.map((step: any) => step.name), ['AddKeyDown', 'AddPointerMove', 'AddKeyUp']);
        assert.deepEqual(group.steps.map((step: any) => step.status), ['passed', 'broken', 'passed']);
        assert.equal(group.status, 'broken');
    });
});
