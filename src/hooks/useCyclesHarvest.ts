import { useState, useEffect, useCallback } from "react";

export interface HarvestVolume {
  title: string;
  inBase: boolean;
  read: boolean;
  owned: boolean;
  awarded: boolean;
}
export interface HarvestCycle {
  cycle: string;
  volumes: HarvestVolume[];
  total: number;
  inBase: number;
  owned: number;
  read: number;
  missing: number;
}
export interface CyclesHarvest {
  cycles: HarvestCycle[];
  totalCycles: number;
  harvestedAt: number | null;
}

/**
 * Zebrane cykle (GET /api/cycles-harvest) — z blobów `CycleCache` uzupełnionych
 * Rytuałem Żniw. Odczyt jest lekki (agregacja po stronie serwera z cache książek).
 */
export function useCyclesHarvest() {
  const [view, setView] = useState<CyclesHarvest | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchHarvest = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/cycles-harvest");
      if (!res.ok) throw new Error(`Błąd serwera: ${res.status}`);
      setView(await res.json());
    } catch (e: any) {
      setError(e?.message || "Nie udało się pobrać zebranych cykli.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchHarvest(); }, [fetchHarvest]);

  return { view, loading, error, fetchHarvest };
}
