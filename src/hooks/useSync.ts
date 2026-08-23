import { useState, useCallback } from "react";
import { SyncState } from "../types";
import { useSSEStream } from "./useSSEStream";

// Dłuższy wariant komunikatu o zawieszeniu (dopisek o Diagnostyce) — specyficzny dla rytuałów sync.
const SYNC_STALL_MESSAGE =
  "Połączenie z serwerem zawisło (brak odpowiedzi przez 30 s). Możliwe buforowanie strumienia przez hosting. Odśwież stronę i spróbuj ponownie; jeśli się powtarza, uruchom Diagnostykę.";

export function useSync(endpoint: string, stopEndpoint: string, initialState: Partial<SyncState> = {}) {
  const [state, setState] = useState<SyncState>({
    loading: false,
    result: null,
    error: null,
    statusMessage: null,
    progress: null,
    startTime: null,
    ...initialState
  });

  const stopSync = useCallback(async () => {
    try {
      const res = await fetch(stopEndpoint, { method: "POST" });
      const data = await res.json();
      if (!data.success) {
        console.warn(data.message);
      }
    } catch (err) {
      console.error("Błąd zatrzymywania synchronizacji:", err);
    }
  }, [stopEndpoint]);

  const { run } = useSSEStream(endpoint, { timeoutMs: 30000 });

  const startSync = useCallback(async (params: any = {}, onComplete?: (result: any) => any, initialStatus: string | null = "Inicjowanie połączenia...") => {
    setState(prev => ({
      ...prev,
      loading: true,
      error: null,
      result: null,
      statusMessage: initialStatus,
      progress: null,
      startTime: Date.now()
    }));

    // Wynik complete/error łapiemy do `outcome`, bo callback nie może bezpośrednio
    // wyjść z startSync; sam transport (fetch + watchdog + SSE) żyje w useSSEStream.
    let outcome: { type: "complete"; result: any } | { type: "error" } | null = null;
    const streamResult = await run(params, (data) => {
      if (data.type === "status") {
        setState(prev => ({ ...prev, statusMessage: data.message ?? null }));
      } else if (data.type === "progress") {
        setState(prev => ({
          ...prev,
          statusMessage: data.message ?? null,
          progress: { current: data.current ?? 0, total: data.total ?? 0 }
        }));
      } else if (data.type === "complete") {
        const finalResult = onComplete ? onComplete(data.result) : data.result;
        setState(prev => ({ ...prev, result: finalResult, statusMessage: null, progress: null, loading: false }));
        outcome = { type: "complete", result: finalResult };
        return true;
      } else if (data.type === "error") {
        setState(prev => ({ ...prev, error: data.error ?? "Nieznany błąd synchronizacji", loading: false, statusMessage: null, progress: null }));
        outcome = { type: "error" };
        return true;
      }
    });

    if (outcome) {
      const o = outcome as { type: "complete"; result: any } | { type: "error" };
      return o.type === "complete" ? o.result : false;
    }

    if (!streamResult.ok) {
      const message = streamResult.stalled ? SYNC_STALL_MESSAGE : (streamResult.error ?? "Błąd synchronizacji.");
      console.error(`Sync error for ${endpoint}:`, streamResult.error);
      setState(prev => ({ ...prev, error: message, loading: false, statusMessage: null, progress: null }));
      return false;
    }

    // Strumień zakończył się bez complete/error (np. anulowanie po stronie serwera) —
    // nie zostawiaj UI w wiecznym stanie ładowania.
    setState(prev => ({ ...prev, loading: false, statusMessage: null, progress: null }));
    return false;
  }, [endpoint, run]);

  const reset = useCallback(() => {
    setState(prev => ({
      ...prev,
      loading: false,
      result: null,
      error: null,
      statusMessage: null,
      progress: null,
      startTime: null
    }));
  }, []);

  return { state, setState, startSync, stopSync, reset, endpoint };
}
