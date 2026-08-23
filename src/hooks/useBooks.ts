import { useState, useEffect, useCallback } from "react";
import { BookIndexEntry } from "../types";

/**
 * Pobiera odchudzony indeks książek z `GET /api/books` RAZ i trzyma w stanie.
 * Cała wyszukiwarka „Skryptorium" filtruje ten indeks w pamięci (client-side),
 * więc żaden znak w polu wyszukiwania nie uderza do sieci ani do Notion.
 */
export function useBooks() {
  const [books, setBooks] = useState<BookIndexEntry[] | null>(null);
  // Startujemy w stanie ładowania — fetch leci od razu w useEffect (po paint), więc
  // bez tego pierwsza klatka pokazywałaby pusty stan zamiast spinnera.
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

  return { books, loading, error, fetchBooks };
}
