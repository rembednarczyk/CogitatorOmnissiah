import { useState, useCallback } from "react";
import type { IdentifiedBooks } from "./useStats";

type BookRef = { id: string; title: string; author: string; year?: number | null };

const LIBRARY_TAGS = ["Biblioteka", "Biblioteka 9"];

interface Deps {
  identifiedBooks: IdentifiedBooks;
  addBookToLibrarySection: (tag: string, book: BookRef) => void;
  fetchStats: () => Promise<void>;
}

/**
 * Oznaczanie pozycji jako przeczytanej (`POST /api/mark-as-read`).
 * `markingId` blokuje równoległe zapisy; `markedIds` (klucz „{tag}:{pageId}")
 * trzyma pozycje otagowane w tej sesji — skan biblioteki wyklucza już
 * otagowane książki, więc rekord ma zostać widoczny, lecz z wyłączonym haczykiem.
 *
 * tag domyślnie „Przeczytane" (zasoby posiadane / statystyki biblioteczne);
 * skaner filii przekazuje znacznik filii („Biblioteka" / „Biblioteka 9").
 */
export function useMarkAsRead({ identifiedBooks, addBookToLibrarySection, fetchStats }: Deps) {
  const [markingId, setMarkingId] = useState<string | null>(null);
  const [markedIds, setMarkedIds] = useState<Set<string>>(new Set());

  const markAsRead = useCallback(async (pageId: string, tag?: string) => {
    if (markingId) return;
    setMarkingId(pageId);
    try {
      const res = await fetch("/api/mark-as-read", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ pageId, tag })
      });
      if (!res.ok) throw new Error("Błąd podczas oznaczania pozycji");
      const sourceTag = tag ?? "Przeczytane";
      setMarkedIds(prev => new Set(prev).add(`${sourceTag}:${pageId}`));

      // Tag filii dopisuje pozycję wyłącznie do sekcji „Książki dostępne w
      // bibliotekach" — aktualizujemy ją optymistycznie (natychmiast, odporne na
      // opóźnienie odczytu Notiona). „Przeczytane" zmienia wiele przekrojów
      // (autorzy, chronologia, posiadane), więc tam robimy pełny refetch.
      if (LIBRARY_TAGS.includes(sourceTag)) {
        const book = Object.values(identifiedBooks).flat().find(b => b.id === pageId);
        if (book) addBookToLibrarySection(sourceTag, book);
        else await fetchStats();
      } else {
        await fetchStats();
      }
    } catch (err: any) {
      console.error(err.message);
      alert(`Błąd: ${err.message}`);
    } finally {
      setMarkingId(null);
    }
  }, [markingId, identifiedBooks, addBookToLibrarySection, fetchStats]);

  return { markingId, markedIds, markAsRead };
}
