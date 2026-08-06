import { useState, useEffect, useCallback } from "react";

export interface AuthorStat {
  name: string;
  read: number;
  total: number;
  books: { id: string; title: string; year?: number | null; read: boolean }[];
}

export interface AwardCoverageStat {
  name: string;
  count: number;
  total: number;
}

export interface YearlyStat {
  year: string;
  read: number;
  total: number;
  books: { id: string; title: string; author: string; read: boolean }[];
}

export interface Stats {
  authorStats: AuthorStat[];
  awardBooksStats: { read: number; total: number };
  ownedUnread: { id: string; title: string; author: string; year?: number | null }[];
  awardCoverage: AwardCoverageStat[];
  allAwardsStats: { read: number; total: number };
  yearlyStats: YearlyStat[];
  libraryStats: {
    id: string;
    name: string;
    books: { id: string; title: string; author: string; year?: number | null; read: boolean }[];
  }[];
}

export interface IdentifiedBooks {
  [libraryId: string]: { id: string; title: string; author: string; year?: number | null }[];
}

export function useStats() {
  const [stats, setStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchStats = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/stats?t=${Date.now()}`);
      if (!res.ok) throw new Error("Błąd podczas pobierania statystyk");
      const data = await res.json();
      setStats(data);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchStats();
  }, [fetchStats]);

  return { stats, loading, error, fetchStats };
}
