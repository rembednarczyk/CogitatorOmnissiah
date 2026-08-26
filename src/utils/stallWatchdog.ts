/**
 * Watchdog against SSE stream hangs. Hosting/proxy can buffer the
 * response such that `reader.read()` never returns — without this the scan left
 * an eternal spinner. The server sends keepalive every 5 s, so on a healthy connection
 * `arm()` (called per chunk by consumeSSE) keeps resetting the countdown and the abort
 * never happens; after `timeoutMs` of silence the signal is aborted.
 */
export interface StallWatchdog {
  /** Pass to `fetch(..., { signal })`. */
  signal: AbortSignal;
  /** Reset the countdown (call after every received stream fragment). */
  arm: () => void;
  /** Stop the watchdog (call in finally). */
  clear: () => void;
  /** Whether the watchdog aborted the connection due to silence. */
  readonly stalled: boolean;
}

export function createStallWatchdog(timeoutMs = 30000): StallWatchdog {
  const controller = new AbortController();
  let timer: ReturnType<typeof setTimeout> | null = null;
  let stalled = false;

  return {
    signal: controller.signal,
    arm() {
      if (timer) clearTimeout(timer);
      timer = setTimeout(() => {
        stalled = true;
        controller.abort();
      }, timeoutMs);
    },
    clear() {
      if (timer) {
        clearTimeout(timer);
        timer = null;
      }
    },
    get stalled() {
      return stalled;
    },
  };
}
