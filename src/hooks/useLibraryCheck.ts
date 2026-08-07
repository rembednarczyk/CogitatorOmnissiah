import { useState, useCallback, useRef } from "react";
import { IdentifiedBooks } from "./useStats";
import { consumeSSE } from "../utils/sse";
import { createStallWatchdog } from "../utils/stallWatchdog";

export type { IdentifiedBooks };

export function useLibraryCheck() {
  const [identifiedBooks, setIdentifiedBooks] = useState<IdentifiedBooks>({});
  const [checkingLibrary, setCheckingLibrary] = useState<string | null>(null);
  const [checkProgress, setCheckProgress] = useState<{ current: number; total: number; message: string; startTime: number | null } | null>(null);
  const [libraryError, setLibraryError] = useState<string | null>(null);
  // Ref zamiast stanu w strażniku — stan w domknięciu bywa nieaktualny
  // (dwa kliknięcia w tym samym ticku uruchamiały dwa równoległe skany)
  const isCheckingRef = useRef(false);

  const checkLibrary = useCallback(async (libraryId: string, libraryCode: string) => {
    if (isCheckingRef.current) return;
    isCheckingRef.current = true;
    setCheckingLibrary(libraryId);
    setIdentifiedBooks(prev => ({ ...prev, [libraryId]: [] }));
    setCheckProgress({ current: 0, total: 0, message: "Inicjowanie...", startTime: Date.now() });
    setLibraryError(null);
    
    // Skaner biblioteki bywa długi (setki tytułów, retry/timeout OPAC) — 90 s
    // ciszy zamiast 30 s; keepalive co 5 s resetuje odliczanie na żywym łączu.
    const watchdog = createStallWatchdog(90000);

    return new Promise<void>(async (resolve) => {
      try {
        watchdog.arm();
        const response = await fetch("/api/library-check", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ libraryCode }),
          signal: watchdog.signal
        });

        if (!response.ok) throw new Error("Błąd podczas sprawdzania biblioteki");

        await consumeSSE(response.body, (data) => {
          if (data.type === "progress") {
            setCheckProgress(prev => ({
              current: data.current ?? 0,
              total: data.total ?? 0,
              message: data.message ?? "",
              startTime: prev?.startTime || Date.now()
            }));
          } else if (data.type === "status") {
            setCheckProgress(prev => ({
              current: prev?.current || 0,
              total: prev?.total || 0,
              message: data.message ?? "",
              startTime: prev?.startTime || Date.now()
            }));
          } else if (data.type === "match") {
            setIdentifiedBooks(prev => {
              const currentLibraryBooks = prev[libraryId] || [];
              // Check if already exists to avoid duplicates (though server shouldn't send them)
              if (currentLibraryBooks.some(b => b.id === data.result.id)) return prev;
              return {
                ...prev,
                [libraryId]: [...currentLibraryBooks, data.result]
              };
            });
          } else if (data.type === "complete") {
            setIdentifiedBooks(prev => ({
              ...prev,
              [libraryId]: data.result.results
            }));
          } else if (data.type === "error") {
            throw new Error(data.error);
          }
        }, watchdog.arm);
        resolve();
      } catch (err: any) {
        setLibraryError(
          watchdog.stalled
            ? "Połączenie z serwerem zawisło (brak odpowiedzi przez 90 s). Możliwe buforowanie strumienia przez hosting. Odśwież i spróbuj ponownie."
            : err.message
        );
        resolve(); // Resolve anyway so the next library can be checked
      } finally {
        watchdog.clear();
        isCheckingRef.current = false;
        setCheckingLibrary(null);
        setCheckProgress(null);
      }
    });
  }, []);

  const stopLibraryCheck = useCallback(async () => {
    try {
      await fetch("/api/library-check/stop", { method: "POST" });
    } catch (err) {
      console.error("Error stopping library check:", err);
    }
  }, []);

  const checkAllLibraries = useCallback(async (branches: { id: string; code: string }[]) => {
    if (isCheckingRef.current) return;

    for (const branch of branches) {
      // Need to await the completion of each check.
      // Since checkLibrary sets state and doesn't return a promise that resolves on completion,
      // we need to wrap the fetch logic or modify checkLibrary to return a promise.
      // For simplicity, we'll implement the sequential check here or modify checkLibrary.
      await checkLibrary(branch.id, branch.code);
      // Wait a moment between libraries
      await new Promise(resolve => setTimeout(resolve, 1000));
    }
  }, [checkLibrary]);

  return { 
    identifiedBooks, 
    checkingLibrary, 
    checkProgress, 
    libraryError, 
    checkLibrary, 
    checkAllLibraries,
    stopLibraryCheck 
  };
}
