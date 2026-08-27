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
const OPEN_LIBRARY = "https://openlibrary.org/search.json";

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

/** Collect deduped canonical ISBN-13s from a Google Books volumes response. */
function collectIsbns(items: any[]): string[] {
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

/** One Google Books query → deduped ISBN-13s. */
async function queryGoogle(q: string): Promise<string[]> {
  const res = await axios.get(GOOGLE_BOOKS, { params: { q, maxResults: 20 }, timeout: 10000 });
  return collectIsbns(Array.isArray(res.data?.items) ? res.data.items : []);
}

/**
 * OpenLibrary reverse lookup → deduped ISBN-13s. Keyless and tolerant of server/
 * datacenter IPs (Google Books rate-limits keyless calls hard from cloud hosts like
 * Render), and each `doc.isbn` already lists every edition's ISBN — ideal here.
 */
async function queryOpenLibrary(title: string, author: string): Promise<string[]> {
  const params: Record<string, string | number> = { title, limit: 5, fields: "isbn" };
  if (author) params.author = author;
  const res = await axios.get(OPEN_LIBRARY, { params, timeout: 10000 });
  const docs: any[] = Array.isArray(res.data?.docs) ? res.data.docs : [];
  const found = new Set<string>();
  for (const doc of docs) {
    const isbns: any[] = Array.isArray(doc?.isbn) ? doc.isbn : [];
    for (const raw of isbns) {
      const normalized = normalizeIsbn(String(raw || ""));
      if (normalized) found.add(normalized);
    }
  }
  return Array.from(found);
}

/**
 * Reverse lookup for the enrichment ritual (barcode "variant B"): given a book's
 * title (+ optional author), collect the canonical ISBN-13s of ALL its editions, so
 * any edition's barcode identifies the row. The use case is „do I own this title at
 * all", not „this exact edition" — so we store every ISBN we can resolve, deduped.
 *
 * Two sources for resilience: Google Books first, then OpenLibrary if Google finds
 * nothing OR is unreachable (Google rate-limits keyless calls hard from datacenter
 * IPs like Render — the enrichment came back empty in production for exactly this).
 * Returns the deduped union. Returns [] when the sources respond but nothing matches;
 * throws only when BOTH sources error (a real outage the caller reports per book), so
 * a genuine „no match" is never confused with „couldn't reach the API".
 *
 * Google query terms are joined with a SPACE, not a literal „+": axios encodes a space
 * as „+" (the Google Books AND separator), whereas a literal „+" is escaped to „%2B"
 * and read as one garbage token — which returns zero results for every book.
 */
export async function lookupIsbnsByTitle(title: string, author?: string): Promise<string[]> {
  const cleanTitle = (title || "").trim();
  if (!cleanTitle) return [];
  // Notion „Autor" can be multi-value („A, B") — the first author is enough to disambiguate
  // and avoids over-constraining the query (some editions list a translator/editor too).
  const firstAuthor = (author || "").split(",")[0].trim();

  const found = new Set<string>();
  const failures: string[] = [];

  // Source 1: Google Books (title+author, then title-only fallback).
  try {
    if (firstAuthor) {
      (await queryGoogle(`intitle:${cleanTitle} inauthor:${firstAuthor}`)).forEach((x) => found.add(x));
    }
    if (found.size === 0) {
      (await queryGoogle(`intitle:${cleanTitle}`)).forEach((x) => found.add(x));
    }
  } catch (e: any) {
    log.warn("Google Books niedostępne", { title: cleanTitle, error: e?.message });
    failures.push(`google-books: ${e?.message || "błąd"}`);
  }

  // Source 2: OpenLibrary — only if Google found nothing (or was unreachable).
  if (found.size === 0) {
    try {
      (await queryOpenLibrary(cleanTitle, firstAuthor)).forEach((x) => found.add(x));
    } catch (e: any) {
      log.warn("OpenLibrary niedostępne", { title: cleanTitle, error: e?.message });
      failures.push(`openlibrary: ${e?.message || "błąd"}`);
    }
  }

  // Both sources errored AND nothing found → a real outage, surface it to the caller.
  if (found.size === 0 && failures.length === 2) {
    throw new Error(failures.join("; "));
  }
  return Array.from(found);
}
