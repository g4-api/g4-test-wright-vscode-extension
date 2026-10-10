/*
 * Evaluates a G4 automation response into a Test Wright status.
 *
 * Rules (agreed for Test Wright):
 * - failed:  at least one Assert plugin reported Evaluation = false.
 * - warning: no failed assertion, but plugins or sessions reported exceptions (Allure: broken).
 * - passed:  neither of the above.
 * - broken:  is never produced here; the run service sets it when the bot could not run at all.
 */
import { TestStatus } from '../models/test-wright-models';

/**
 * Walks a G4 automation response and summarizes assertions and exceptions.
 */
export class ResultEvaluator {
    /**
     * Evaluates one automation response.
     *
     * @param response - The parsed JSON returned by POST api/v4/g4/automation/invoke.
     * @returns The status, counts, and a short message naming the first problem found.
     */
    public static evaluate(response: any): EvaluationResult {
        const result: EvaluationResult = {
            status: 'passed',
            message: '',
            assertions: { total: 0, failed: 0 },
            exceptions: 0
        };

        const sessions = ResultEvaluator.getSessions(response);

        // An engine answer without any session means the automation never started.
        if (sessions.length === 0) {
            result.status = 'broken';
            result.message = 'The engine response holds no automation session.';

            return result;
        }

        const exceptionMessages: string[] = [];
        const assertionMessages: string[] = [];

        for (const session of sessions) {
            // Session-level exceptions (engine, driver) count as warnings too.
            for (const entry of session?.responseData?.exceptions ?? []) {
                const message = ResultEvaluator.getExceptionMessage(entry);

                if (message !== '') {
                    result.exceptions += 1;
                    exceptionMessages.push(message);
                }
            }

            for (const stage of session?.responseTree?.stages ?? []) {
                for (const job of stage?.jobs ?? []) {
                    for (const plugin of job?.plugins ?? []) {
                        ResultEvaluator.visitPlugin(plugin, result, assertionMessages, exceptionMessages);
                    }
                }
            }
        }

        // Session exceptions are also echoed on the plugins; count each message once.
        result.exceptions = new Set(exceptionMessages).size;

        if (result.assertions.failed > 0) {
            result.status = 'failed';
            result.message = assertionMessages[0] ?? 'An assertion failed.';
        } else if (result.exceptions > 0) {
            result.status = 'warning';
            result.message = exceptionMessages[0] ?? 'The automation reported exceptions.';
        }

        return result;
    }

    /**
     * Reads the assertion entities of an Assert plugin.
     *
     * @param plugin - A plugin node of the response tree.
     * @returns The entity contents and the evaluation (true unless an entity says false).
     */
    public static getAssertion(plugin: any): { entities: any[]; evaluation: boolean } {
        const entities: any[] = [];
        let evaluation = true;

        for (const extraction of plugin?.extractions ?? []) {
            for (const entity of extraction?.entities ?? []) {
                const content = entity?.content ?? {};

                entities.push(content);

                // Keys vary in casing between engine versions (Evaluation, evaluation). One false
                // entity fails the assertion, whatever the entities after it say.
                for (const [key, value] of Object.entries(content)) {
                    const isTrue = value === true || `${value}`.toLowerCase() === 'true';

                    if (key.toLowerCase() === 'evaluation' && !isTrue) {
                        evaluation = false;
                    }
                }
            }
        }

        return { entities, evaluation };
    }

    /**
     * Returns the exception payloads of a plugin node, without empty entries.
     *
     * @param plugin - A plugin node of the response tree.
     * @returns The exception entries that carry an exception.
     */
    public static getPluginExceptions(plugin: any): any[] {
        return (plugin?.exceptions ?? []).filter((entry: any) => entry?.exception);
    }

    /**
     * Builds a one-line message from an exception entry.
     *
     * @param entry - An entry of an exceptions array.
     * @returns The reason phrase or exception message, or an empty string.
     */
    public static getExceptionMessage(entry: any): string {
        if (!entry?.exception) {
            return '';
        }

        const message = entry.reasonPhrase || entry.exception.Message || entry.exception.message || entry.type || 'Exception';
        const source = entry.pluginName || entry.reference?.name || '';

        return source === '' ? `${message}` : `${source}: ${message}`;
    }

    /**
     * Returns the automation responses held by an engine answer.
     *
     * @remarks
     * POST automation/invoke wraps each response under its automation id
     * ({ "<id>": { sessions, performancePoint, ... } }); saved reports may hold the bare response.
     * Both shapes are accepted, as in the automation report page.
     *
     * @param response - The engine answer or a saved report.
     * @returns The response objects that carry sessions.
     */
    public static getResponses(response: any): any[] {
        if (response === null || typeof response !== 'object') {
            return [];
        }

        if (response.sessions && typeof response.sessions === 'object') {
            return [response];
        }

        return Object.values(response).filter((value: any) => value?.sessions && typeof value.sessions === 'object');
    }

    /**
     * Returns the sessions of a response as an array.
     *
     * @param response - The engine answer or a saved report (bare or wrapped by automation id).
     * @returns The session objects (each response keys its sessions by driver session id).
     */
    public static getSessions(response: any): any[] {
        return ResultEvaluator.getResponses(response).flatMap((entry) => Object.values(entry.sessions));
    }

    /**
     * Whether a plugin node is an Assert rule.
     *
     * @param plugin - A plugin node of the response tree.
     * @returns True for the Assert plugin.
     */
    public static testAssert(plugin: any): boolean {
        return `${plugin?.rule?.pluginName ?? ''}`.toLowerCase() === 'assert';
    }

    // Counts one plugin node and its children into the running result.
    private static visitPlugin(plugin: any, result: EvaluationResult, assertionMessages: string[], exceptionMessages: string[]): void {
        if (ResultEvaluator.testAssert(plugin)) {
            const assertion = ResultEvaluator.getAssertion(plugin);

            result.assertions.total += 1;

            if (!assertion.evaluation) {
                result.assertions.failed += 1;
                assertionMessages.push(ResultEvaluator.getAssertionMessage(plugin, assertion.entities));
            }
        }

        for (const entry of ResultEvaluator.getPluginExceptions(plugin)) {
            exceptionMessages.push(ResultEvaluator.getExceptionMessage(entry));
        }

        for (const child of plugin?.plugins ?? []) {
            ResultEvaluator.visitPlugin(child, result, assertionMessages, exceptionMessages);
        }
    }

    // Describes a failed assertion: "Assert: expected 'x' (Match) but was 'y'".
    private static getAssertionMessage(plugin: any, entities: any[]): string {
        const name = plugin?.rule?.capabilities?.displayName || plugin?.rule?.pluginName || 'Assert';
        const content = entities.find((entity) => entity && (entity.Expected !== undefined || entity.Actual !== undefined));

        if (content === undefined) {
            return `${name}: assertion failed.`;
        }

        const operator = content.Operator ? ` (${content.Operator})` : '';

        return `${name}: expected '${content.Expected ?? ''}'${operator} but was '${content.Actual ?? ''}'.`;
    }
}

// Compile-time contracts stay after the executable code.

/**
 * Outcome of evaluating one automation response.
 */
export interface EvaluationResult {
    status: TestStatus;
    message: string;
    assertions: { total: number; failed: number };
    exceptions: number;
}
