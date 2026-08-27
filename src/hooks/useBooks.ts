import { useState, useEffect, useCallback } from "react";
import { BookIndexEntry } from "../types";
import { fetchWithTimeout } from "../utils/http";

/**
 * Fetches the slimmed-down book index from `GET /api/books` ONCE and holds it in state.
 * The whole „Skryptorium" search filters this index in memory (client-side),
 * so no keystroke in the search field hits the network or Notion.
 */
export function useBooks(all = false) {
  const [books, setBooks] = useState<BookIndexEntry[] | null>(null);
  // Start in loading state — the fetch fires right away in useEffect (after paint), so
  // without this the first frame would show an empty state instead of a spinner.
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchBooks = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      // `all=1` (Skryptorium/scan) includes cycle volumes; without it (Regał) award-only.
      const res = await fetch(`/api/books?${all ? "all=1&" : ""}t=${Date.now()}`);
      if (!res.ok) throw new Error("Błąd podczas pobierania książek");
      const data = await res.json();
      setBooks(data);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [all]);

  /**
   * Fetch the FRESHEST index (bypasses the server's 5-min cache) with a hard
   * timeout, update state, and return the data. Used by the scan flow: an ISBN
   * may have been added by the enrichment ritual after this page mounted, so the
   * in-memory list can be stale exactly for a just-enriched book. Rejects on
   * failure/timeout so the caller can fall back to the current index.
   */
  const refetchFresh = useCallback(async (): Promise<BookIndexEntry[]> => {
    const res = await fetchWithTimeout(`/api/books?fresh=1&${all ? "all=1&" : ""}t=${Date.now()}`);
    if (!res.ok) throw new Error("Błąd podczas pobierania książek");
    const data = await res.json();
    setBooks(data);
    return data;
  }, [all]);

  useEffect(() => {
    fetchBooks();
  }, [fetchBooks]);

  return { books, loading, error, fetchBooks, refetchFresh, setBooks };
}
