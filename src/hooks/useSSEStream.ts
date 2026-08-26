import { useCallback } from "react";
import { SyncEvent } from "../types";
import { consumeSSE } from "../utils/sse";
import { createStallWatchdog } from "../utils/stallWatchdog";

export interface SSEStreamResult {
  /** The stream ran without an HTTP error / throw / stall. (complete vs error is decided by `onEvent`.) */
  ok: boolean;
  /** Error message (HTTP, thrown by `onEvent`, or the default stall) — null when `ok`. */
  error: string | null;
  /** Whether the watchdog aborted the connection due to silence (lets the caller override the message). */
  stalled: boolean;
}

/** Default stream-stall message (seconds from `timeoutMs`). */
export function defaultStallMessage(timeoutMs: number): string {
  return `Połączenie z serwerem zawisło (brak odpowiedzi przez ${Math.round(timeoutMs / 1000)} s). Możliwe buforowanie strumienia przez hosting. Odśwież i spróbuj ponownie.`;
}

/**
 * Shared SSE transport for hooks (useSync, useVintedCheck, useLibraryCheck): one
 * POST, `res.ok` check, `consumeSSE` with a stall watchdog and derivation of the
 * error message (HTTP / throw from `onEvent` / stall). Does NOT hold UI state —
 * the caller owns its state and sets it in `onEvent` and around `run`, deciding what
 * to do with the result. This way each hook differs only in its event routing.
 */
export function useSSEStream(endpoint: string, opts?: { timeoutMs?: number }) {
  const timeoutMs = opts?.timeoutMs ?? 30000;

  const run = useCallback(async (
    body: any,
    onEvent: (event: SyncEvent) => boolean | "stop" | void,
  ): Promise<SSEStreamResult> => {
    const watchdog = createStallWatchdog(timeoutMs);
    try {
      watchdog.arm();
      const fetchOptions: RequestInit = {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        signal: watchdog.signal,
      };
      if (body && Object.keys(body).length > 0) fetchOptions.body = JSON.stringify(body);

      const res = await fetch(endpoint, fetchOptions);
      if (!res.ok) {
        let message = `Błąd serwera: ${res.status}`;
        try { const j = await res.json(); message = j.error || message; } catch { /* non-JSON */ }
        throw new Error(message);
      }

      // onChunk = watchdog.arm (keepalive also counts as activity).
      await consumeSSE(res.body, onEvent, watchdog.arm);
      return { ok: true, error: null, stalled: false };
    } catch (err: any) {
      const stalled = watchdog.stalled;
      return { ok: false, stalled, error: stalled ? defaultStallMessage(timeoutMs) : (err?.message || "Błąd połączenia.") };
    } finally {
      watchdog.clear();
    }
  }, [endpoint, timeoutMs]);

  return { run };
}
