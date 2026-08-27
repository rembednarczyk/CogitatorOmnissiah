import { useState, useEffect, useCallback } from "react";
import { markReadRequest } from "../utils/http";

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
 * Harvested cycles (GET /api/cycles-harvest) — aggregation of cycle ROWS (the `Cykl` field)
 * materialized by the „Rytuał Żniw". Lightweight read (server aggregation off the book cache).
 */
export function useCyclesHarvest() {
  const [view, setView] = useState<CyclesHarvest | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  // `silent` = background refresh (after marking a volume) without flashing the whole card.
  // `fresh` = skip the 5-min book cache on the server (manual „Odśwież Dane").
  const fetchHarvest = useCallback(async (silent = false, fresh = false) => {
    if (!silent) setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/cycles-harvest${fresh ? "?fresh=1" : ""}`);
      if (!res.ok) throw new Error(`Błąd serwera: ${res.status}`);
      setView(await res.json());
    } catch (e: any) {
      setError(e?.message || "Nie udało się pobrać zebranych cykli.");
    } finally {
      if (!silent) setLoading(false);
    }
  }, []);

  /**
   * Toggles the „Źródło" tag (Przeczytane/Posiadam) on a volume row and refreshes
   * the view. `active=true` adds it, `false` removes it (mark/unmark-as-read endpoint).
   */
  const toggleSource = useCallback(async (id: string, tag: "Przeczytane" | "Posiadam", active: boolean) => {
    if (!id) return; // without an ID there's nothing to mark (and an empty busyId would disarm the lock)
    setBusyId(id);
    setError(null);
    try {
      await markReadRequest(id, tag, active, "Nie udało się zmienić statusu tomu.");
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
