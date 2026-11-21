/*
 * Splits the engine response of a bot that ran its own data source into one response per data row.
 *
 * The engine runs a bot with an N-row data source as N automations (one per row) that share one
 * group id, then merges them into ONE response: a single entry keyed by the group id holding N
 * sessions, one per row. Each session carries its row in `dataProvider` and its zero-based row
 * index in `iteration` (left out of the JSON for row 0). Without splitting, Test Wright would
 * report the rows as one test whose steps repeat once per row.
 *
 * Splitting keeps every session as it is and wraps it in its own response of the same shape
 * ({ "<group id>": { dataProvider, performancePoint, sessions: { "<session id>": session } } }),
 * so every reader of a .g4rpt (the evaluator, the Allure converter, the report viewer) sees a
 * normal one-session response.
 *
 * Free of the vscode module, so the service stays testable under plain Node.
 */
import { DataSetService } from './data-set-service';
import { ResultEvaluator } from './result-evaluator';

/**
 * Splits merged data-row responses.
 */
export class ResponseSplitter {
    /**
     * Returns one response per data row, ordered by row.
     *
     * @param response - The engine answer of one bot (wrapped by group id, or bare).
     * @returns The row responses, ordered by data row; empty when the answer holds no session.
     *
     * @remarks
     * Compute-only: the answer is not changed; each row response references the original session
     * object. The engine collects sessions in an unordered bag, so the order is restored from each
     * session's iteration, not from the dictionary order.
     */
    public static getRowResponses(response: any): RowResponse[] {
        const rowResponses: RowResponse[] = [];

        // Walk every response entry and every session, so each data row becomes one row response.
        for (const [groupKey, entry] of ResponseSplitter.getResponseEntries(response)) {
            for (const [sessionId, session] of Object.entries<any>(entry.sessions)) {
                const dataRow = ResponseSplitter.getDataRow(session);
                const rowEntry = {
                    dataProvider: session?.dataProvider ?? [],
                    performancePoint: session?.performancePoint ?? {},
                    sessions: { [sessionId]: session }
                };

                // Keep the engine's wrapping by group id, so the row file has the shape of a normal answer.
                const rowResponse = groupKey === '' ? rowEntry : { [groupKey]: rowEntry };

                rowResponses.push({
                    dataRow,
                    values: ResponseSplitter.getRowValues(session),
                    start: ResponseSplitter.getTime(session?.performancePoint?.start),
                    stop: ResponseSplitter.getTime(session?.performancePoint?.end),
                    response: rowResponse
                });
            }
        }

        // Restore the row order the data source defined, which the engine's bag does not keep.
        return rowResponses.sort((left, right) => left.dataRow - right.dataRow);
    }

    /**
     * Tests whether an engine request runs the bot's own data source.
     *
     * @param request - The engine request sent for one bot.
     * @returns True when the request carries a data source with a source to read.
     */
    public static testDataSource(request: any): boolean {
        const source = request?.dataSource?.source;

        return typeof source === 'string' && source.trim() !== '';
    }

    // Converts a session's zero-based iteration into a one-based data row; a missing iteration is row 1.
    private static getDataRow(session: any): number {
        // Accept only a whole, non-negative index; the engine leaves the field out for row 0.
        const iteration = session?.iteration;
        const isIndex = typeof iteration === 'number' && Number.isInteger(iteration) && iteration >= 0;

        return isIndex ? iteration + 1 : 1;
    }

    // Returns the response entries with their group key; a bare response has an empty key.
    private static getResponseEntries(response: any): [string, any][] {
        // A bare response (a saved report) holds its sessions directly and has no group key.
        if (response?.sessions && typeof response.sessions === 'object') {
            return [['', response]];
        }

        // An engine answer keys each response by its group id; keep the ones that hold sessions.
        const responses = new Set(ResultEvaluator.getResponses(response));

        return Object.entries<any>(response ?? {}).filter(([, value]) => responses.has(value));
    }

    // Returns the row a session ran with, as text values (TestRecord.values holds text).
    private static getRowValues(session: any): Record<string, string> | undefined {
        // Take the session's one row; the engine sends it as a one-item dataProvider array.
        const row = Array.isArray(session?.dataProvider) ? session.dataProvider[0] : undefined;
        const isRow = row !== null && typeof row === 'object' && !Array.isArray(row);

        // Leave the values out when the session names no row, so the record reads as a static bot's.
        if (!isRow) {
            return undefined;
        }

        // Convert each value the way the iterations editor does, so objects keep a JSON form.
        const values: Record<string, string> = {};

        for (const [name, value] of Object.entries(row)) {
            values[name] = DataSetService.convertToText(value);
        }

        return values;
    }

    // Converts an ISO time from a performance point into epoch milliseconds; 0 when missing.
    private static getTime(value: unknown): number {
        // Treat a missing or non-text time as unknown, so the caller falls back to its own times.
        if (typeof value !== 'string') {
            return 0;
        }

        // Parse the time; an unreadable one is unknown too.
        const time = Date.parse(value);

        return Number.isNaN(time) ? 0 : time;
    }
}

// Compile-time contracts stay after the executable code, interfaces precede type aliases, and
// local dependency chains take priority over A-Z sorting.

/**
 * The response of one data row, split from a merged engine answer.
 */
export interface RowResponse {
    /** One-based data row, from the session's zero-based iteration. */
    dataRow: number;

    /** The row the session ran with, as text; undefined when the session names no row. */
    values?: Record<string, string>;

    /** Row start in epoch milliseconds, from the session's performance point; 0 when missing. */
    start: number;

    /** Row end in epoch milliseconds, from the session's performance point; 0 when missing. */
    stop: number;

    /** A one-session response of the engine's shape, saved as the row's .g4rpt. */
    response: any;
}
