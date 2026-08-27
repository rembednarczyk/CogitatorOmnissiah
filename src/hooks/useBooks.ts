import { useState, useEffect, useCallback } from "react";
import { BookIndexEntry } from "../types";

/**
 * Fetches the slimmed-down book index from `GET /api/books` ONCE and holds it in state.
 * The whole „Skryptorium" search filters this index in memory (client-side),
 * so no keystroke in the search field hits the network or Notion.
 */
export function useBooks() {
  const [books, setBooks] = useState<BookIndexEntry[] | null>(null);
  // Start in loading state — the fetch fires right away in useEffect (after paint), so
  // without this the first frame would show an empty state instead of a spinner.
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchBooks = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/books?t=${Date.now()}`);
      if (!res.ok) throw new Error("Błąd podczas pobierania rekordów archiwum");
      const data = await res.json();
      setBooks(data);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchBooks();
  }, [fetchBooks]);

  return { books, loading, error, fetchBooks, setBooks };
}
