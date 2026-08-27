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

/**
 * Reverse lookup for the enrichment ritual (barcode "variant B"): given a book's
 * title (+ optional author), find its canonical ISBN-13 via Google Books so it can
 * be stored on the row and matched directly by a scan. Picks the first volume that
 * carries a usable ISBN (preferring ISBN-13, falling back to a normalized ISBN-10).
 * Returns the ISBN-13 string, or null when nothing usable is found. Throws only on
 * an unexpected error so the caller can report it per book.
 */
export async function lookupIsbnByTitle(title: string, author?: string): Promise<string | null> {
  const cleanTitle = (title || "").trim();
  if (!cleanTitle) return null;
  const parts = [`intitle:${cleanTitle}`];
  const cleanAuthor = (author || "").trim();
  if (cleanAuthor) parts.push(`inauthor:${cleanAuthor}`);

  const res = await axios.get(GOOGLE_BOOKS, { params: { q: parts.join("+"), maxResults: 5 }, timeout: 10000 });
  const items: any[] = Array.isArray(res.data?.items) ? res.data.items : [];
  for (const item of items) {
    const ids: any[] = item?.volumeInfo?.industryIdentifiers || [];
    // Prefer an ISBN-13; otherwise take an ISBN-10 and let normalizeIsbn convert it.
    const isbn13 = ids.find((x) => x?.type === "ISBN_13")?.identifier;
    const isbn10 = ids.find((x) => x?.type === "ISBN_10")?.identifier;
    const normalized = normalizeIsbn(isbn13 || isbn10 || "");
    if (normalized) return normalized;
  }
  return null;
}
