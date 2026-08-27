import { NotionBook, BookIndexEntry } from "../src/types";
import { isAwardBook } from "./bookCategory";

/**
 * Pure projection of full Notion records → a slimmed-down search index.
 * Cuts heavy fields (`vintedData` blob, `*RichText`), keeps only what
 * „Skryptorium" filters/renders on. Keeps a record having ANY
 * title — Polish OR original; untranslated books (original title only)
 * should be searchable too. Only a record with no title at all is dropped (a skeleton).
 */
export function toSearchIndex(books: NotionBook[]): BookIndexEntry[] {
  return books
    // Regał and Skryptorium stay award-only — side cycle volumes are excluded
    // (they have their own „Archiwum Cykli" view); optional inclusion will come later.
    .filter((b) => isAwardBook(b))
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
      isbn: b.isbn,
    }));
}
