import { useState, useCallback, useRef } from "react";
import { useSSEStream } from "./useSSEStream";

/**
 * Stage 2: incrementally fetching sellers for STORED offers (Notion), resumable
 * between runs. Doesn't depend on the current scan — works off the database.
 * Builds on the shared `useSSEStream` transport (120 s watchdog like the Vinted
 * scan); this hook only routes events to its own progress/result state.
 */
export function useVintedResolveSellers() {
  const [isResolving, setIsResolving] = useState(false);
  const [resolveProgress, setResolveProgress] = useState<{ current: number; total: number; message: string } | null>(null);
  const [resolveResult, setResolveResult] = useState<{ resolved: number; remaining: number; message: string } | null>(null);
  const [resolveError, setResolveError] = useState<string | null>(null);
  const runningRef = useRef(false);

  const { run } = useSSEStream("/api/vinted-resolve-sellers", { timeoutMs: 120000 });

  const runResolve = useCallback(async () => {
    if (runningRef.current) return;
    runningRef.current = true;
    setIsResolving(true);
    setResolveProgress({ current: 0, total: 0, message: "Inicjowanie..." });
    setResolveResult(null);
    setResolveError(null);

    const result = await run({}, (data) => {
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
    });

    if (!result.ok && result.error) setResolveError(result.error);
    runningRef.current = false;
    setIsResolving(false);
    setResolveProgress(null);
  }, [run]);

  const stopResolve = useCallback(async () => {
    try {
      await fetch("/api/vinted-resolve-sellers/stop", { method: "POST" });
    } catch (err) {
      console.error("Error stopping seller resolution:", err);
    }
  }, []);

  return { isResolving, resolveProgress, resolveResult, resolveError, runResolve, stopResolve };
}
