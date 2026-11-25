/*
 * Tests the status Test Wright gives an engine response, for Parallel containers and Input Actions Groups.
 */
import * as assert from 'node:assert/strict';
import { ResultEvaluator } from '../../services/result-evaluator';
import {
    newInputActionsResponse,
    newParallelResponse,
    newPluginNode,
    newResponse
} from './response-fixtures';

describe('ResultEvaluator.evaluate', () => {
    it('fails a run whose Parallel container has a failed assertion in one of its jobs', () => {
        const result = ResultEvaluator.evaluate(newParallelResponse());

        assert.equal(result.status, 'failed');
        assert.deepEqual(result.assertions, { total: 2, failed: 1 });
        assert.equal(result.message, "Assert: expected 'Ready' (Equal) but was 'Busy'.");
    });

    it('warns once for an input action failure that the session echoes', () => {
        const result = ResultEvaluator.evaluate(newInputActionsResponse());

        assert.equal(result.status, 'warning');
        assert.equal(result.exceptions, 1);
        assert.equal(result.message, 'AddPointerMove: Element not found');
    });

    it('passes a run whose nested containers hold only passing assertions', () => {
        const group = newPluginNode({
            pluginName: 'InvokeInputActions',
            children: [newPluginNode({ pluginName: 'AddKeyDown' }), newPluginNode({ pluginName: 'Assert', evaluation: true })]
        });
        const result = ResultEvaluator.evaluate(newResponse([[[group], [newPluginNode({ pluginName: 'Assert', evaluation: true })]]]));

        assert.equal(result.status, 'passed');
        assert.deepEqual(result.assertions, { total: 2, failed: 0 });
        assert.equal(result.exceptions, 0);
    });

    it('reports a response without a session as broken', () => {
        const result = ResultEvaluator.evaluate({ 'automation-1': { sessions: {} } });

        assert.equal(result.status, 'broken');
    });

    it('reads a saved report that holds the bare response', () => {
        const wrapped = newParallelResponse();
        const bare = wrapped['automation-1'];

        assert.deepEqual(ResultEvaluator.evaluate(bare), ResultEvaluator.evaluate(wrapped));
    });
});
