import { useState, useCallback } from "react";
import { SyncState, SyncEvent } from "../types";
import { consumeSSE } from "../utils/sse";

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

    // Watchdog: jeśli strumień zawiśnie (proxy buforuje, brak jakiegokolwiek
    // ruchu), przerwij po 30 s ciszy. Serwer wysyła keepalive co 5 s, więc na
    // zdrowym połączeniu timer jest stale resetowany i nigdy nie odpala.
    const controller = new AbortController();
    let watchdog: ReturnType<typeof setTimeout> | null = null;
    let stalled = false;
    const armWatchdog = () => {
      if (watchdog) clearTimeout(watchdog);
      watchdog = setTimeout(() => {
        stalled = true;
        controller.abort();
      }, 30000);
    };

    try {
      const fetchOptions: RequestInit = {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        signal: controller.signal,
      };

      if (params && Object.keys(params).length > 0) {
        fetchOptions.body = JSON.stringify(params);
      }

      armWatchdog();
      const res = await fetch(endpoint, fetchOptions);

      if (!res.ok) {
        let errorMessage = `Błąd serwera: ${res.status}`;
        try {
          const errorData = await res.json();
          errorMessage = errorData.error || errorMessage;
        } catch (e) {
          // If not JSON, use default message
        }
        throw new Error(errorMessage);
      }

      // Konsumpcja strumienia SSE; onChunk resetuje watchdog przy każdym odczycie
      // (także keepalive liczy się jako aktywność). Wynik complete/error łapiemy
      // do `outcome`, bo callback nie może bezpośrednio wyjść z startSync.
      let outcome: { type: "complete"; result: any } | { type: "error" } | null = null;
      await consumeSSE(res.body, (data: SyncEvent) => {
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
          setState(prev => ({
            ...prev,
            result: finalResult,
            statusMessage: null,
            progress: null,
            loading: false
          }));
          outcome = { type: "complete", result: finalResult };
          return true;
        } else if (data.type === "error") {
          setState(prev => ({
            ...prev,
            error: data.error ?? "Nieznany błąd synchronizacji",
            loading: false,
            statusMessage: null,
            progress: null
          }));
          outcome = { type: "error" };
          return true;
        }
      }, armWatchdog);

      if (outcome) {
        const result = outcome as { type: "complete"; result: any } | { type: "error" };
        return result.type === "complete" ? result.result : false;
      }
      // Strumień zakończył się bez zdarzenia complete/error (np. anulowanie po
      // stronie serwera) — nie zostawiaj UI w wiecznym stanie ładowania
      setState(prev => ({ ...prev, loading: false, statusMessage: null, progress: null }));
      return false;
    } catch (err: any) {
      const message = stalled
        ? "Połączenie z serwerem zawisło (brak odpowiedzi przez 30 s). Możliwe buforowanie strumienia przez hosting. Odśwież stronę i spróbuj ponownie; jeśli się powtarza, uruchom Diagnostykę."
        : err?.message || "Błąd synchronizacji.";
      console.error(`Sync error for ${endpoint}:`, err);
      setState(prev => ({
        ...prev,
        error: message,
        loading: false,
        statusMessage: null,
        progress: null
      }));
      return false;
    } finally {
      if (watchdog) clearTimeout(watchdog);
    }
  }, [endpoint]);

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
