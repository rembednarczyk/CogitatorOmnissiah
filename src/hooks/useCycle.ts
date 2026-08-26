import { useState, useCallback, useRef } from "react";

export interface CycleVolume {
  title: string;
  isCurrent: boolean;
  inBase: boolean;
  read: boolean;
  owned: boolean;
  awarded: boolean;
  awards: string[];
}
export interface CycleView {
  cycleName: string;
  volumes: CycleVolume[];
  unreadBefore: number;
  source: "chain" | "template" | "mixed" | "single";
}

/**
 * On-demand cycle preview (GET /api/cycle). Cache per (title|author) in a ref — reopening
 * the panel for the same book does not re-query the server. The backend caches too.
 */
export function useCycle() {
  const [view, setView] = useState<CycleView | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const cache = useRef<Map<string, CycleView | null>>(new Map());

  const fetchCycle = useCallback(async (title: string, author: string) => {
    const key = `${title}|${author}`;
    setError(null);
    if (cache.current.has(key)) { setView(cache.current.get(key)!); return; }
    setLoading(true);
    setView(null);
    try {
      const res = await fetch(`/api/cycle?title=${encodeURIComponent(title)}&author=${encodeURIComponent(author || "")}`);
      if (res.status === 404) { cache.current.set(key, null); setView(null); setError("Nie znaleziono danych cyklu dla tej pozycji."); return; }
      if (!res.ok) { const j = await res.json().catch(() => null); throw new Error(j?.error || `Błąd serwera: ${res.status}`); }
      const data: CycleView = await res.json();
      cache.current.set(key, data);
      setView(data);
    } catch (e: any) {
      setError(e?.message || "Nie udało się pobrać cyklu.");
    } finally {
      setLoading(false);
    }
  }, []);

  const reset = useCallback(() => { setView(null); setError(null); setLoading(false); }, []);

  return { view, loading, error, fetchCycle, reset };
}
