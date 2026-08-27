import axios from "axios";
import { normalizeIsbn } from "./isbn";
import { createLogger } from "../logger";

/**
 * Resolves an ISBN to a book (title + author) via the Google Books API. This is the
 * engine of the barcode "variant A": the scanned code has no direct row in the base
 * (we don't store ISBNs by default), so we resolve it to a title and hand that to the
 * existing Skryptorium fuzzy search. Backend-side to dodge CORS and cache repeats.
 */

const log = createLogger("IsbnLookup");
const GOOGLE_BOOKS = "https://www.googleapis.com/books/v1/volumes";

export interface IsbnBook {
  /** Canonical ISBN-13 that was resolved. */
  isbn: string;
  title: string;
  author: string;
  year?: string;
  source: "google-books";
}

// Process-memory cache keyed by canonical ISBN-13. `null` = looked up, not found
// (cached to avoid re-hitting the API); transient errors are NOT cached.
const cache = new Map<string, IsbnBook | null>();

export async function lookupIsbn(rawCode: string): Promise<IsbnBook | null> {
  const isbn = normalizeIsbn(rawCode);
  if (!isbn) return null;
  if (cache.has(isbn)) return cache.get(isbn)!;
  try {
    const res = await axios.get(GOOGLE_BOOKS, { params: { q: `isbn:${isbn}` }, timeout: 10000 });
    const info = res.data?.items?.[0]?.volumeInfo;
    if (!info?.title) {
      cache.set(isbn, null);
      return null;
    }
    const book: IsbnBook = {
      isbn,
      title: [info.title, info.subtitle].filter(Boolean).join(": "),
      author: Array.isArray(info.authors) ? info.authors.join(", ") : "",
      year: typeof info.publishedDate === "string" ? info.publishedDate.slice(0, 4) : undefined,
      source: "google-books",
    };
    cache.set(isbn, book);
    return book;
  } catch (e: any) {
    log.warn("Błąd zapytania Google Books", { isbn, error: e?.message });
    return null;
  }
}
