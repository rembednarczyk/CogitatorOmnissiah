import { NotionBook, BookIndexEntry } from "../src/types";

/**
 * Czysta projekcja pełnych rekordów Notion → odchudzony indeks wyszukiwarki.
 * Odcina ciężkie pola (`vintedData` blob, `*RichText`), zostawia tylko to, po
 * czym filtruje/renderuje „Skryptorium". Zostawia rekord mający JAKIKOLWIEK
 * tytuł — polski LUB oryginalny; nieprzetłumaczone książki (tylko tytuł oryg.)
 * też mają być wyszukiwalne. Odpada dopiero rekord bez żadnego tytułu (szkielet).
 */
export function toSearchIndex(books: NotionBook[]): BookIndexEntry[] {
  return books
    .filter((b) => (b.plTitle && b.plTitle.trim().length > 0) || (b.origTitle && b.origTitle.trim().length > 0))
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
      shelfOrder: b.shelfOrder,
    }));
}
