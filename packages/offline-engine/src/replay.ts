/**
 * Replay failure classification
 *
 * When a queued offline mutation is replayed on reconnect it can fail for two
 * very different reasons, and the queue must treat them differently:
 *
 *  - `retry`   — transient (no network, 5xx, timeout, rate limit). Retrying the
 *                exact same request will eventually succeed, so the background
 *                loop should keep going with backoff.
 *  - `blocked` — the server rejected the request itself (validation, missing
 *                referenced row, permission, conflicting state). Replaying it
 *                unchanged will fail identically forever, so auto-retry must
 *                stop and a human has to retry or discard it.
 *
 * Without this split a single bad payload retries every 60s for the life of the
 * install while the badge shows a count that never clears.
 */

export type ReplayDisposition = 'retry' | 'blocked';

/**
 * HTTP statuses in the 4xx range that are still worth retrying automatically:
 * 408 Request Timeout and 429 Too Many Requests both resolve on their own.
 */
const RETRYABLE_CLIENT_STATUSES = new Set([408, 429]);

/**
 * Decide whether a failed replay should keep retrying automatically.
 *
 * `status` is the HTTP status from the API, or `undefined` for a transport-level
 * failure (offline, DNS, CORS, aborted) — which is always transient.
 */
export function classifyReplayFailure(status?: number): ReplayDisposition {
  if (typeof status !== 'number' || !Number.isFinite(status)) return 'retry';
  if (status >= 400 && status < 500 && !RETRYABLE_CLIENT_STATUSES.has(status)) {
    return 'blocked';
  }
  return 'retry';
}
