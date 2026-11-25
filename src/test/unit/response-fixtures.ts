/*
 * Engine response fixtures shaped like POST api/v4/g4/automation/invoke answers, for the reporting tests.
 *
 * Every builder returns a new object, so a test that mutates a response cannot leak into another test.
 */

/**
 * Builds a plugin node of the response tree.
 *
 * @param options - The rule name, and optionally its children, an assertion evaluation and an exception message.
 * @returns The plugin node.
 */
export function newPluginNode(options: PluginNodeOptions): any {
    const { pluginName, children = [], evaluation, exceptionMessage } = options;

    // An Assert node carries its evaluation in an extraction entity, as the engine writes it.
    const extractions = evaluation === undefined
        ? []
        : [{ entities: [{ content: { Evaluation: evaluation, Expected: 'Ready', Actual: evaluation ? 'Ready' : 'Busy', Operator: 'Equal' } }] }];

    // A failed plugin reports its exception with the plugin name, which the reports show as the source.
    const exceptions = exceptionMessage === undefined
        ? []
        : [{ pluginName, exception: { Message: exceptionMessage } }];

    return {
        rule: { pluginName },
        performancePoint: { start: '2026-11-25T10:00:00Z', end: '2026-11-25T10:00:01Z' },
        extractions,
        exceptions,
        plugins: children
    };
}

/**
 * Wraps stages of jobs into an engine answer with one session, keyed by automation id.
 *
 * @param stages - The stages, each a list of jobs, each a list of plugin nodes.
 * @param sessionExceptions - Exception entries the session reports next to its plugins.
 * @returns The engine answer.
 */
export function newResponse(stages: any[][][], sessionExceptions: any[] = []): any {
    return {
        'automation-1': {
            sessions: {
                'session-1': {
                    responseData: { exceptions: sessionExceptions },
                    responseTree: {
                        stages: stages.map((jobs, stageIndex) => ({
                            name: `Stage ${stageIndex + 1}`,
                            jobs: jobs.map((plugins, jobIndex) => ({ name: `Job ${jobIndex + 1}`, plugins }))
                        }))
                    }
                }
            }
        }
    };
}

/**
 * Builds a response whose single stage runs two jobs in a Parallel container, the second with a failed assertion.
 *
 * @returns The engine answer.
 */
export function newParallelResponse(): any {
    // A Parallel container inside a stage runs its jobs side by side; the response lists them as sibling jobs.
    const passingJob = [newPluginNode({ pluginName: 'OpenUrl' }), newPluginNode({ pluginName: 'Assert', evaluation: true })];
    const failingJob = [newPluginNode({ pluginName: 'InvokeClick' }), newPluginNode({ pluginName: 'Assert', evaluation: false })];

    return newResponse([[passingJob, failingJob]]);
}

/**
 * Builds a response with an Input Actions Group whose second input action failed.
 *
 * @returns The engine answer.
 */
export function newInputActionsResponse(): any {
    // The group is one plugin node with its input actions as children.
    const group = newPluginNode({
        pluginName: 'InvokeInputActions',
        children: [
            newPluginNode({ pluginName: 'AddKeyDown' }),
            newPluginNode({ pluginName: 'AddPointerMove', exceptionMessage: 'Element not found' }),
            newPluginNode({ pluginName: 'AddKeyUp' })
        ]
    });

    // The engine echoes a plugin exception on the session with the same plugin name and message.
    const echoedException = { pluginName: 'AddPointerMove', exception: { Message: 'Element not found' } };

    return newResponse([[[newPluginNode({ pluginName: 'OpenUrl' }), group]]], [echoedException]);
}

// Compile-time contracts stay after the executable code.

/**
 * Options of a fixture plugin node.
 */
export interface PluginNodeOptions {
    /** The rule's plugin name, which names the report step. */
    pluginName: string;

    /** Child plugin nodes, as a container such as an Input Actions Group holds them. */
    children?: any[];

    /** The assertion evaluation; set only for Assert nodes. */
    evaluation?: boolean;

    /** The message of an exception the plugin reported; absent for a plugin that succeeded. */
    exceptionMessage?: string;
}
