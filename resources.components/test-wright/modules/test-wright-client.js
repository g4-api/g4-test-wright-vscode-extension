'use strict';

/*
 * Host bridge client.
 *
 * The single abstraction the page uses to talk to the extension host. Every request goes through
 * `g4Host.request(type, payload)`, which posts { kind: 'request', id, type, payload } and resolves
 * with the matching { kind: 'response', id, result | error }. Host events ({ kind: 'event', type,
 * payload }) reach subscribers registered with `g4Host.on(type, callback)`.
 *
 * `testClient` wraps the bot-specific calls (discovery, runs) with the same method names the
 * desktop Test Wright renderer used, so the feature modules stay close to the original.
 */
(function () {
    // The VS Code API can be acquired only once per page.
    const vscodeApi = acquireVsCodeApi();

    // Pending requests by id: { resolve, reject }.
    const pendingRequests = new Map();

    // Event subscribers by type.
    const eventListeners = new Map();

    let nextRequestId = 1;

    /**
     * Routes host messages to pending requests and event subscribers.
     *
     * @param {MessageEvent} event - The message event.
     * @returns {void}
     */
    const onHostMessage = (event) => {
        const message = event.data;

        if (message?.kind === 'response') {
            const pending = pendingRequests.get(message.id);

            if (!pending) {
                return;
            }

            pendingRequests.delete(message.id);

            if (message.error) {
                pending.reject(new Error(message.error));
            } else {
                pending.resolve(message.result);
            }

            return;
        }

        if (message?.kind === 'event') {
            (eventListeners.get(message.type) || []).forEach((callback) => callback(message.payload));
        }
    };

    window.addEventListener('message', onHostMessage);

    // Unhandled page errors reach the extension's output channel for diagnosis.
    window.addEventListener('error', (event) => {
        vscodeApi.postMessage({ kind: 'console', text: `${event.message} (${event.filename}:${event.lineno})` });
    });

    window.addEventListener('unhandledrejection', (event) => {
        vscodeApi.postMessage({ kind: 'console', text: `Unhandled rejection: ${event.reason?.message || event.reason}` });
    });

    const g4Host = {
        /**
         * Sends a request to the host.
         *
         * @param {string} type - Request type (for example 'bots:find').
         * @param {object} [payload] - Request payload.
         * @returns {Promise<any>} The host result; rejects with the host error.
         */
        request(type, payload = {}) {
            const id = nextRequestId++;

            return new Promise((resolve, reject) => {
                pendingRequests.set(id, { resolve, reject });
                vscodeApi.postMessage({ kind: 'request', id, type, payload });
            });
        },

        /**
         * Subscribes to a host event.
         *
         * @param {string} type - Event type (for example 'run:event').
         * @param {Function} callback - Receives the event payload.
         * @returns {Function} Unsubscribes.
         */
        on(type, callback) {
            const callbacks = eventListeners.get(type) || [];

            callbacks.push(callback);
            eventListeners.set(type, callbacks);

            return () => eventListeners.set(type, (eventListeners.get(type) || []).filter((candidate) => candidate !== callback));
        }
    };

    class TestWrightClient {
        /**
         * Discovers the bots under a folder.
         *
         * @param {object} options - Discovery options.
         * @param {string} options.folder - The bots folder.
         * @returns {Promise<object>} { folderPath, tests, warnings, error? }.
         */
        findTests({ folder }) {
            return g4Host.request('bots:find', { folderPath: folder });
        }

        /**
         * Runs bots, routing live events of this run to the callbacks.
         *
         * @param {object} request - The run request (runId, tests, folderPath, environment, parallel, collectAllure).
         * @param {object} [callbacks] - { onStart(id), onTest(event) }.
         * @returns {Promise<object>} The run summary.
         */
        invokeTests(request, { onStart, onTest } = {}) {
            const onRunEvent = (event) => {
                if (event.runId !== request.runId) {
                    return;
                }

                if (event.type === 'start' && onStart) {
                    onStart(event.id);
                } else if (event.type === 'result' && onTest) {
                    onTest(event);
                }
            };

            // Subscribe before the run starts so no early event is missed.
            const unsubscribe = g4Host.on('run:event', onRunEvent);

            return g4Host.request('run:invoke', request).finally(unsubscribe);
        }

        /**
         * Stops a run.
         *
         * @param {number} runId - The run id.
         * @returns {Promise<boolean>} True when the run was active.
         */
        stopRun(runId) {
            return g4Host.request('run:stop', { runId });
        }
    }

    globalThis.g4Host = g4Host;
    globalThis.testClient = new TestWrightClient();
})();
