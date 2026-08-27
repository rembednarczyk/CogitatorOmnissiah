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
 * title (+ optional author), collect the canonical ISBN-13s of ALL its editions via
 * Google Books, so any edition's barcode identifies the row. The use case is „do I
 * own this title at all", not „this exact edition" — so we store every ISBN we can
 * resolve (ISBN-13 directly, ISBN-10 converted to 13), deduped. Returns the list
 * (possibly empty). Throws only on an unexpected error so the caller can report it.
 */
export async function lookupIsbnsByTitle(title: string, author?: string): Promise<string[]> {
  const cleanTitle = (title || "").trim();
  if (!cleanTitle) return [];
  const parts = [`intitle:${cleanTitle}`];
  const cleanAuthor = (author || "").trim();
  if (cleanAuthor) parts.push(`inauthor:${cleanAuthor}`);

  const res = await axios.get(GOOGLE_BOOKS, { params: { q: parts.join("+"), maxResults: 20 }, timeout: 10000 });
  const items: any[] = Array.isArray(res.data?.items) ? res.data.items : [];
  const found = new Set<string>();
  for (const item of items) {
    const ids: any[] = item?.volumeInfo?.industryIdentifiers || [];
    for (const id of ids) {
      // ISBN-13 used directly; ISBN-10 converted; anything else (ISSN, OTHER) skipped by normalizeIsbn.
      if (id?.type === "ISBN_13" || id?.type === "ISBN_10") {
        const normalized = normalizeIsbn(id.identifier || "");
        if (normalized) found.add(normalized);
      }
    }
  }
  return Array.from(found);
}
