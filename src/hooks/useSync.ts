import { useState, useCallback } from "react";
import { SyncState, SyncEvent } from "../types";

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

    try {
      const fetchOptions: RequestInit = {
        method: "POST",
        headers: { "Content-Type": "application/json" },
      };
      
      if (params && Object.keys(params).length > 0) {
        fetchOptions.body = JSON.stringify(params);
      }

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
      
      const reader = res.body?.getReader();
      const decoder = new TextDecoder();
      let buffer = "";
      
      if (reader) {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          
          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split('\n\n');
          buffer = lines.pop() || "";
          
          for (const line of lines) {
            if (line.startsWith("data: ")) {
              try {
                const data: SyncEvent = JSON.parse(line.substring(6));
                
                if (data.type === "status") {
                  setState(prev => ({ ...prev, statusMessage: data.message }));
                } else if (data.type === "progress") {
                  setState(prev => ({ 
                    ...prev, 
                    statusMessage: data.message,
                    progress: { current: data.current, total: data.total }
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
                  return finalResult;
                } else if (data.type === "error") {
                  setState(prev => ({ 
                    ...prev, 
                    error: data.error, 
                    loading: false,
                    statusMessage: null,
                    progress: null
                  }));
                  return false;
                }
              } catch (e) {
                console.error("Błąd parsowania SSE:", e);
              }
            }
          }
        }
      }
      // Strumień zakończył się bez zdarzenia complete/error (np. anulowanie po
      // stronie serwera) — nie zostawiaj UI w wiecznym stanie ładowania
      setState(prev => ({ ...prev, loading: false, statusMessage: null, progress: null }));
      return false;
    } catch (err: any) {
      console.error(`Sync error for ${endpoint}:`, err);
      setState(prev => ({ 
        ...prev, 
        error: err.message, 
        loading: false, 
        statusMessage: null, 
        progress: null 
      }));
      return false;
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
