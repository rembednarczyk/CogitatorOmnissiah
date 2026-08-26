import { useState, useCallback, useRef } from "react";
import { consumeSSE } from "../utils/sse";
import { createStallWatchdog } from "../utils/stallWatchdog";

/**
 * Stage 2: incrementally fetching sellers for STORED offers (Notion), resumable
 * between runs. Doesn't depend on the current scan — works off the database. SSE pattern
 * like in useVintedCheck (120 s watchdog). Returns progress and a summary (resolved/remaining).
 */
export function useVintedResolveSellers() {
  const [isResolving, setIsResolving] = useState(false);
  const [resolveProgress, setResolveProgress] = useState<{ current: number; total: number; message: string } | null>(null);
  const [resolveResult, setResolveResult] = useState<{ resolved: number; remaining: number; message: string } | null>(null);
  const [resolveError, setResolveError] = useState<string | null>(null);
  const runningRef = useRef(false);

  const runResolve = useCallback(async () => {
    if (runningRef.current) return;
    runningRef.current = true;
    setIsResolving(true);
    setResolveProgress({ current: 0, total: 0, message: "Inicjowanie..." });
    setResolveResult(null);
    setResolveError(null);

    const watchdog = createStallWatchdog(120000);
    try {
      watchdog.arm();
      const response = await fetch("/api/vinted-resolve-sellers", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        signal: watchdog.signal,
      });
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || `Błąd serwera: ${response.status}`);
      }

      await consumeSSE(response.body, (data) => {
        if (data.type === "progress" || data.type === "status") {
          setResolveProgress(prev => ({
            current: data.current ?? prev?.current ?? 0,
            total: data.total ?? prev?.total ?? 0,
            message: data.message ?? "",
          }));
        } else if (data.type === "complete") {
          setResolveResult({
            resolved: data.result?.resolved ?? 0,
            remaining: data.result?.remaining ?? 0,
            message: data.result?.message ?? "",
          });
        } else if (data.type === "error") {
          throw new Error(data.error);
        }
      }, watchdog.arm);
    } catch (err: any) {
      setResolveError(
        watchdog.stalled
          ? "Połączenie z serwerem zawisło (brak odpowiedzi przez 120 s). Odśwież i spróbuj ponownie."
          : err.message
      );
    } finally {
      watchdog.clear();
      runningRef.current = false;
      setIsResolving(false);
      setResolveProgress(null);
    }
  }, []);

  const stopResolve = useCallback(async () => {
    try {
      await fetch("/api/vinted-resolve-sellers/stop", { method: "POST" });
    } catch (err) {
      console.error("Error stopping seller resolution:", err);
    }
  }, []);

  return { isResolving, resolveProgress, resolveResult, resolveError, runResolve, stopResolve };
}
