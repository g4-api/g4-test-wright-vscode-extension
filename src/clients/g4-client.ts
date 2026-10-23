/*
 * HTTP client for the G4 engine endpoints Test Wright uses.
 *
 * Endpoint contracts:
 * - POST api/v4/g4/automation/invoke          body: automation (bot) JSON, returns the automation response.
 * - PUT  api/v4/g4/environments/{name}?encode  body: environment parameters, 2xx on success.
 * - GET  api/v4/g4/ping                       2xx when the engine is up.
 *
 * RESOURCES:
 * Fetch API (Node): https://nodejs.org/api/globals.html#fetch
 * HTTP client (Node): https://nodejs.org/api/http.html#httprequesturl-options-callback
 */
import * as http from 'node:http';
import * as https from 'node:https';

/**
 * Thin wrapper over fetch for the G4 engine.
 */
export class G4Client {
    // Engine base URL, without a trailing slash.
    private readonly _baseUrl: string;

    /**
     * Creates a client for one engine.
     *
     * @param baseUrl - Engine base URL, for example http://localhost:9944.
     */
    constructor(baseUrl: string) {
        this._baseUrl = baseUrl.replace(/\/+$/, '');
    }

    /**
     * The engine base URL this client talks to.
     */
    public get baseUrl(): string {
        return this._baseUrl;
    }

    /**
     * Invokes one automation and waits for its response.
     *
     * @remarks
     * Never throws: transport failures, non-2xx answers, and unreadable bodies come back as an
     * error result so the caller can mark the bot broken. Aborting the signal cancels the request
     * on this side only; the engine may finish the session.
     *
     * @param automation - The automation request body (the merged bot).
     * @param signal - Aborts the request (Stop).
     * @returns The parsed response, or the error.
     */
    public async invokeAutomation(automation: any, signal?: AbortSignal): Promise<InvokeResult> {
        try {
            // Not fetch: its 300-second headers timeout fails every bot that runs longer, because
            // the engine answers only when the bot finishes.
            const response = await G4Client.sendRequest(`${this._baseUrl}/api/v4/g4/automation/invoke`, JSON.stringify(automation), signal);
            const isOk = response.status >= 200 && response.status < 300;

            if (!isOk) {
                return { ok: false, status: response.status, error: `HTTP ${response.status} ${response.statusText}: ${G4Client.getShortText(response.text)}` };
            }

            try {
                return { ok: true, status: response.status, data: JSON.parse(response.text) };
            } catch {
                return { ok: false, status: response.status, error: `The engine answered with invalid JSON: ${G4Client.getShortText(response.text)}` };
            }
        } catch (error: any) {
            const isAbort = error?.name === 'AbortError' || signal?.aborted === true;

            return {
                ok: false,
                status: 0,
                aborted: isAbort,
                error: isAbort ? 'Canceled.' : `Engine unreachable at ${this._baseUrl}: ${error?.cause?.message ?? error?.message ?? error}`
            };
        }
    }

    /**
     * Checks that the engine answers.
     *
     * @returns True when the ping endpoint answers with a 2xx status within 3 seconds.
     */
    public async ping(): Promise<boolean> {
        try {
            const response = await fetch(`${this._baseUrl}/api/v4/g4/ping`, { signal: AbortSignal.timeout(3000) });

            return response.ok;
        } catch {
            return false;
        }
    }

    /**
     * Creates or replaces an environment on the engine.
     *
     * @remarks
     * The engine stores every value as text (Dictionary&lt;string, string&gt;) and rejects the whole
     * environment when one value is not a string, so numbers and booleans are sent as their text,
     * objects and arrays as JSON, and null as an empty string.
     *
     * @param name - Environment name.
     * @param parameters - Environment parameters (name/value pairs).
     * @returns Null on success, or the error text.
     */
    public async updateEnvironment(name: string, parameters: Record<string, any>): Promise<string | null> {
        try {
            const response = await fetch(`${this._baseUrl}/api/v4/g4/environments/${encodeURIComponent(name)}?encode=true`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(G4Client.newEnvironmentBody(parameters)),
                signal: AbortSignal.timeout(10000)
            });

            return response.ok ? null : `HTTP ${response.status} ${response.statusText}: ${G4Client.getShortText(await response.text())}`;
        } catch (error: any) {
            return `${error?.cause?.message ?? error?.message ?? error}`;
        }
    }

    // Converts every parameter value to the text the engine stores.
    private static newEnvironmentBody(parameters: Record<string, any>): Record<string, string> {
        const toText = (value: any): string => {
            if (typeof value === 'string') {
                return value;
            }

            if (value === null || value === undefined) {
                return '';
            }

            return typeof value === 'object' ? JSON.stringify(value) : String(value);
        };

        return Object.fromEntries(Object.entries(parameters).map(([key, value]) => [key, toText(value)]));
    }

    // POSTs a JSON body with node:http(s) and no time limit; the signal aborts the request.
    private static sendRequest(url: string, body: string, signal?: AbortSignal): Promise<{ status: number; statusText: string; text: string }> {
        const target = new URL(url);
        const transport = target.protocol === 'https:' ? https : http;

        return new Promise((resolve, reject) => {
            const request = transport.request(target, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(body) },
                signal
            }, (response) => {
                const chunks: Buffer[] = [];

                response.on('data', (chunk: Buffer) => chunks.push(chunk));
                response.on('error', reject);
                response.on('end', () => resolve({
                    status: response.statusCode ?? 0,
                    statusText: response.statusMessage ?? '',
                    text: Buffer.concat(chunks).toString('utf8')
                }));
            });

            request.on('error', reject);
            request.end(body);
        });
    }

    // Keeps error bodies short enough for one console line.
    private static getShortText(text: string): string {
        const singleLine = text.replace(/\s+/g, ' ').trim();

        return singleLine.length > 300 ? `${singleLine.substring(0, 300)}...` : singleLine;
    }
}

// Compile-time contracts stay after the executable code.

/**
 * Result of an automation invocation.
 */
export interface InvokeResult {
    ok: boolean;
    status: number;
    data?: any;
    error?: string;
    aborted?: boolean;
}
