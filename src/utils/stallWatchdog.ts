/**
 * Watchdog przeciw zawieszeniu strumienia SSE. Hosting/proxy potrafi zbuforować
 * odpowiedź tak, że `reader.read()` nigdy nie wraca — bez tego skan zostawiał
 * wieczny spinner. Serwer wysyła keepalive co 5 s, więc na zdrowym połączeniu
 * `arm()` (wołane per chunk przez consumeSSE) stale resetuje odliczanie i abort
 * nigdy nie następuje; po `timeoutMs` ciszy sygnał jest przerywany.
 */
export interface StallWatchdog {
  /** Przekaż do `fetch(..., { signal })`. */
  signal: AbortSignal;
  /** Zresetuj odliczanie (wołaj po każdym odebranym fragmencie strumienia). */
  arm: () => void;
  /** Zatrzymaj watchdog (wołaj w finally). */
  clear: () => void;
  /** Czy watchdog przerwał połączenie z powodu ciszy. */
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
