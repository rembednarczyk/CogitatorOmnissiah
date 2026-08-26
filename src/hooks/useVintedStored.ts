import { useState, useCallback, useRef } from "react";
import { storedToView, StoredView } from "../utils/vintedSellers";

/**
 * Stage 3: loads STORED Vinted results from Notion (`GET /api/vinted-stored`) and maps
 * them to a view renderable by the same UI as a live scan — tiles and bundles come from the
 * database, without re-scrape. A plain GET (Notion read, not Cloudflare), so no SSE/watchdog.
 *
 * Race protection: `genRef` + AbortController — if during a slow GET the
 * user starts a scan/resolution (which call `clearStored`), the stale response
 * is dropped and doesn't „hijack" the view (doesn't set `stored` after the fact).
 */
export function useVintedStored() {
  const [stored, setStored] = useState<StoredView | null>(null);
  const [isLoadingStored, setIsLoadingStored] = useState(false);
  const [storedError, setStoredError] = useState<string | null>(null);
  const genRef = useRef(0);
  const abortRef = useRef<AbortController | null>(null);

  const loadStored = useCallback(async () => {
    const gen = ++genRef.current;
    abortRef.current?.abort();
    const ac = new AbortController();
    abortRef.current = ac;

    setIsLoadingStored(true);
    setStoredError(null);
    try {
      const res = await fetch("/api/vinted-stored", { signal: ac.signal });
      if (gen !== genRef.current) return; // invalidated (clear/new request)
      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}));
        throw new Error(errorData.error || `Błąd serwera: ${res.status}`);
      }
      const data = await res.json();
      if (gen !== genRef.current) return; // re-check after await
      setStored(storedToView(data.books || []));
    } catch (err: any) {
      if (err?.name === "AbortError" || gen !== genRef.current) return;
      setStoredError(err.message);
    } finally {
      if (gen === genRef.current) setIsLoadingStored(false);
    }
  }, []);

  const clearStored = useCallback(() => {
    // Invalidate any in-flight load (bump the generation + abort) and leave the database view.
    genRef.current++;
    abortRef.current?.abort();
    setIsLoadingStored(false);
    setStored(null);
  }, []);

  return { stored, isLoadingStored, storedError, loadStored, clearStored };
}
