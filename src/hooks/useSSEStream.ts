import { useCallback } from "react";
import { SyncEvent } from "../types";
import { consumeSSE } from "../utils/sse";
import { createStallWatchdog } from "../utils/stallWatchdog";

export interface SSEStreamResult {
  /** Strumień przebiegł bez błędu HTTP / rzutu / stalla. (complete vs error rozstrzyga `onEvent`.) */
  ok: boolean;
  /** Komunikat błędu (HTTP, rzucony przez `onEvent`, lub domyślny stall) — null gdy `ok`. */
  error: string | null;
  /** Czy watchdog przerwał połączenie z powodu ciszy (pozwala nadpisać komunikat po stronie wołającego). */
  stalled: boolean;
}

/** Domyślny komunikat o zawieszeniu strumienia (sekundy z `timeoutMs`). */
export function defaultStallMessage(timeoutMs: number): string {
  return `Połączenie z serwerem zawisło (brak odpowiedzi przez ${Math.round(timeoutMs / 1000)} s). Możliwe buforowanie strumienia przez hosting. Odśwież i spróbuj ponownie.`;
}

/**
 * Wspólny transport SSE dla hooków (useSync, useVintedCheck, useLibraryCheck): jeden
 * POST, sprawdzenie `res.ok`, `consumeSSE` z watchdogiem przeciw zawieszeniu i
 * derywacja komunikatu błędu (HTTP / rzut z `onEvent` / stall). NIE trzyma stanu UI —
 * wołający posiada swój stan i ustawia go w `onEvent` oraz wokół `run`, decydując co
 * zrobić z wynikiem. Dzięki temu każdy hook różni się tylko routingiem zdarzeń.
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
        try { const j = await res.json(); message = j.error || message; } catch { /* nie-JSON */ }
        throw new Error(message);
      }

      // onChunk = watchdog.arm (keepalive też liczy się jako aktywność).
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
