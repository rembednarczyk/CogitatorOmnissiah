import { NotionBook, BookIndexEntry } from "../src/types";

/**
 * Czysta projekcja pełnych rekordów Notion → odchudzony indeks wyszukiwarki.
 * Odcina ciężkie pola (`vintedData` blob, `*RichText`), zostawia tylko to, po
 * czym filtruje/renderuje „Skryptorium". Filtruje książki bez tytułu polskiego
 * (tak jak statystyki) — pusty tytuł to rekord-szkielet, nie do przeszukiwania.
 */
export function toSearchIndex(books: NotionBook[]): BookIndexEntry[] {
  return books
    .filter((b) => b.plTitle && b.plTitle.trim().length > 0)
    .map((b) => ({
      id: b.id,
      plTitle: b.plTitle,
      origTitle: b.origTitle || "",
      author: b.author || "",
      year: b.year || "",
      awards: b.awards || [],
      zrodlo: b.zrodlo || [],
      series: b.currentSeria || "",
      partOfCycle: b.currentCzesccyklu ?? false,
    }));
}
