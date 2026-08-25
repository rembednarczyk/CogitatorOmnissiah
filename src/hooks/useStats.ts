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

export interface LibraryStat {
  id: string;
  name: string;
  books: { id: string; title: string; author: string; year?: number | null; read: boolean }[];
}

export interface IdentifiedBook {
  id: string;
  title: string;
  author: string;
  year?: number | null;
  // Wypełniane przez skan biblioteki (OPAC) — tytuł/autor odczytany z katalogu
  extractedTitle?: string | null;
  extractedAuthor?: string | null;
}

/** Zagregowana dostępność nieprzeczytanych — partycja priorytetowa (każda książka raz). */
export interface AvailabilityStats {
  totalUnread: number;
  /** Posiadane, ale nieprzeczytane. */
  owned: number;
  /** Dostępne do wypożyczenia w bibliotece (tag filii), nieposiadane. */
  library: number;
  /** Dostępne na Vinted (≥1 składowana oferta), nieposiadane i nie w bibliotece. */
  vinted: number;
  /** Bez śladu — brak posiadania, biblioteki i ofert. */
  none: number;
}

export interface PublisherStat { name: string; count: number; read: number }
export interface SeriesStat { name: string; count: number; owned: number; read: number }
export interface CycleStats { partOfCycle: number; standalone: number; total: number }

export interface Stats {
  authorStats: AuthorStat[];
  awardBooksStats: { read: number; total: number };
  ownedUnread: { id: string; title: string; author: string; year?: number | null }[];
  awardCoverage: AwardCoverageStat[];
  allAwardsStats: { read: number; total: number };
  yearlyStats: YearlyStat[];
  availabilityStats: AvailabilityStats;
  publisherStats: PublisherStat[];
  seriesStats: SeriesStat[];
  cycleStats: CycleStats;
  libraryStats: LibraryStat[];
}

export interface IdentifiedBooks {
  [libraryId: string]: IdentifiedBook[];
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

  // Optymistyczne dopisanie książki do sekcji „Książki dostępne w bibliotekach"
  // zaraz po otagowaniu (Biblioteka / Biblioteka 9), bez czekania na kolejny
  // refetch — Notion bywa opóźniony w odczycie tuż po zapisie, więc pełne
  // odświeżenie potrafi jeszcze nie widzieć nowego tagu. `libraryStats[].id`
  // to nazwa tagu, więc dopasowujemy filię po znaczniku.
  const addBookToLibrarySection = useCallback((tag: string, book: { id: string; title: string; author: string; year?: number | null }) => {
    setStats(prev => {
      if (!prev) return prev;
      const libraryStats = prev.libraryStats.map(ls => {
        if (ls.id !== tag || ls.books.some(b => b.id === book.id)) return ls;
        return { ...ls, books: [...ls.books, { ...book, read: false }] };
      });
      return { ...prev, libraryStats };
    });
  }, []);

  useEffect(() => {
    fetchStats();
  }, [fetchStats]);

  return { stats, loading, error, fetchStats, addBookToLibrarySection };
}
