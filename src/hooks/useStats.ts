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
  // Filled by the library scan (OPAC) — title/author read from the catalog
  extractedTitle?: string | null;
  extractedAuthor?: string | null;
}

/** Aggregated availability of unread items — priority partition (each book once). */
export interface AvailabilityStats {
  totalUnread: number;
  /** Owned but unread. */
  owned: number;
  /** Available to borrow from the library (branch tag), not owned. */
  library: number;
  /** Available on Vinted (≥1 stored offer), not owned and not in the library. */
  vinted: number;
  /** No trace — not owned, no library, no offers. */
  none: number;
}

export interface PublisherStat { name: string; count: number; read: number }
export interface SeriesStat { name: string; count: number; owned: number; read: number }
export interface CycleStats { partOfCycle: number; standalone: number; total: number }
export interface DecadeStat { decade: number; total: number; read: number; owned: number }

export interface CheapOffer { bookId: string; bookTitle: string; price: number; currency: string; url: string }
export interface PriceDrop extends CheapOffer { prevPrice: number }
export interface TopSeller { id: string; login: string; url: string; books: number; total: number }
export interface MarketStats {
  currency: string;
  completionCost: number;
  booksWithOffers: number;
  totalOffers: number;
  cheapest: CheapOffer[];
  priceDrops: PriceDrop[];
  topSellers: TopSeller[];
}

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
  decadeStats: DecadeStat[];
  marketStats: MarketStats;
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

  // Optimistically add a book to the „Książki dostępne w bibliotekach" section
  // right after tagging (Biblioteka / Biblioteka 9), without waiting for the next
  // refetch — Notion can lag on reads just after a write, so a full refresh may
  // not see the new tag yet. `libraryStats[].id` is the tag name, so we match the
  // branch by its tag.
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
