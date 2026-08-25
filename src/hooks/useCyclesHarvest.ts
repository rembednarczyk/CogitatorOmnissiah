import { useState, useEffect, useCallback } from "react";

export interface VolumeOffer {
  price: number;
  url: string;
  count: number;
}
export interface HarvestVolume {
  id: string;
  title: string;
  inBase: boolean;
  read: boolean;
  owned: boolean;
  awarded: boolean;
  vinted?: VolumeOffer;
}
export interface HarvestCycle {
  cycle: string;
  volumes: HarvestVolume[];
  total: number;
  inBase: number;
  owned: number;
  read: number;
  missing: number;
  acquireCost?: number;
  acquirable: number;
}
export interface CyclesHarvest {
  cycles: HarvestCycle[];
  totalCycles: number;
  harvestedAt: number | null;
}

/**
 * Zebrane cykle (GET /api/cycles-harvest) — agregacja WIERSZY cykli (pole `Cykl`)
 * materializowanych Rytuałem Żniw. Odczyt lekki (agregacja serwera z cache książek).
 */
export function useCyclesHarvest() {
  const [view, setView] = useState<CyclesHarvest | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  // `silent` = odświeżenie w tle (po oznaczeniu tomu) bez migania całą kartą.
  const fetchHarvest = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/cycles-harvest");
      if (!res.ok) throw new Error(`Błąd serwera: ${res.status}`);
      setView(await res.json());
    } catch (e: any) {
      setError(e?.message || "Nie udało się pobrać zebranych cykli.");
    } finally {
      if (!silent) setLoading(false);
    }
  }, []);

  /**
   * Przełącza znacznik „Źródło" (Przeczytane/Posiadam) na wierszu tomu i odświeża
   * widok. `active=true` dopisuje, `false` usuwa (endpoint mark/unmark-as-read).
   */
  const toggleSource = useCallback(async (id: string, tag: "Przeczytane" | "Posiadam", active: boolean) => {
    setBusyId(id);
    setError(null);
    try {
      const url = active ? "/api/mark-as-read" : "/api/unmark-as-read";
      const res = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ pageId: id, tag }),
      });
      if (!res.ok) { const j = await res.json().catch(() => null); throw new Error(j?.error || `Błąd serwera: ${res.status}`); }
      await fetchHarvest(true);
    } catch (e: any) {
      setError(e?.message || "Nie udało się zmienić statusu tomu.");
    } finally {
      setBusyId(null);
    }
  }, [fetchHarvest]);

  useEffect(() => { fetchHarvest(); }, [fetchHarvest]);

  return { view, loading, error, busyId, fetchHarvest, toggleSource };
}
