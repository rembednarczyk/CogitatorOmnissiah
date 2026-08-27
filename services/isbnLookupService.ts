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
const BN_API = "https://data.bn.org.pl/api/institutions/bibs.json";

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

/** Google Books, with a title-only fallback when the author-qualified query is empty. */
async function fromGoogle(title: string, author: string): Promise<string[]> {
  const found = new Set<string>();
  if (author) (await queryGoogle(`intitle:${title} inauthor:${author}`)).forEach((x) => found.add(x));
  if (found.size === 0) (await queryGoogle(`intitle:${title}`)).forEach((x) => found.add(x));
  return Array.from(found);
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

/** One Biblioteka Narodowa query → deduped ISBN-13s (from MARC 020 $a + the isbnIssn field). */
async function queryBN(params: Record<string, string | number>): Promise<string[]> {
  const res = await axios.get(BN_API, { params: { ...params, limit: 20 }, timeout: 10000 });
  const bibs: any[] = Array.isArray(res.data?.bibs) ? res.data.bibs : [];
  const found = new Set<string>();
  for (const bib of bibs) {
    // Convenience field (may carry the ISBN directly).
    const conv = normalizeIsbn(String(bib?.isbnIssn || ""));
    if (conv) found.add(conv);
    // Authoritative source: MARC field 020, subfield „a" (one ISBN per field; several editions → several 020s).
    const fields: any[] = Array.isArray(bib?.marc?.fields) ? bib.marc.fields : [];
    for (const field of fields) {
      const subs: any[] = Array.isArray(field?.["020"]?.subfields) ? field["020"].subfields : [];
      for (const sub of subs) {
        if (sub && typeof sub.a === "string") {
          const normalized = normalizeIsbn(sub.a);
          if (normalized) found.add(normalized);
        }
      }
    }
  }
  return Array.from(found);
}

/**
 * Biblioteka Narodowa (National Library of Poland) reverse lookup → deduped ISBN-13s.
 * The authoritative source for POLISH editions — the physical books being scanned are
 * Polish (barcode prefix 978-83…), whose ISBNs Google/OpenLibrary often miss. Keyless,
 * public API. Title+author first, then a title-only fallback (BN records the author
 * surname-first, so an author query can miss even when the book is held).
 */
async function fromBN(title: string, author: string): Promise<string[]> {
  const found = new Set<string>();
  if (author) (await queryBN({ title, author })).forEach((x) => found.add(x));
  if (found.size === 0) (await queryBN({ title })).forEach((x) => found.add(x));
  return Array.from(found);
}

/**
 * Reverse lookup for the enrichment ritual (barcode "variant B"): given a book's
 * title (+ optional author), collect the canonical ISBN-13s of ALL its editions, so
 * any edition's barcode identifies the row. The use case is „do I own this title at
 * all", not „this exact edition" — so we store every ISBN we can resolve, deduped.
 *
 * Queries three sources IN PARALLEL and UNIONS the results — not first-hit — so a
 * scan of any edition matches, and crucially the POLISH edition's ISBN (the physical
 * copy) is captured even when Google already returned the original-language one:
 *   - Google Books (broad, but rate-limits keyless calls from datacenter IPs),
 *   - OpenLibrary (keyless, server-IP tolerant),
 *   - Biblioteka Narodowa (authoritative for Polish editions — data.bn.org.pl).
 * Returns the deduped union. Returns [] when the sources respond but nothing matches;
 * throws only when EVERY source errors (a real outage the caller reports per book), so
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

  const sources: { name: string; run: Promise<string[]> }[] = [
    { name: "google-books", run: fromGoogle(cleanTitle, firstAuthor) },
    { name: "openlibrary", run: queryOpenLibrary(cleanTitle, firstAuthor) },
    { name: "biblioteka-narodowa", run: fromBN(cleanTitle, firstAuthor) },
  ];

  const settled = await Promise.allSettled(sources.map((s) => s.run));
  const found = new Set<string>();
  const failures: string[] = [];
  settled.forEach((r, i) => {
    if (r.status === "fulfilled") {
      r.value.forEach((x) => found.add(x));
    } else {
      log.warn("Źródło ISBN niedostępne", { source: sources[i].name, title: cleanTitle, error: r.reason?.message });
      failures.push(`${sources[i].name}: ${r.reason?.message || "błąd"}`);
    }
  });

  // Every source errored (none even responded) → a real outage, surface it to the caller.
  // A source that responded with no match counts as success → treated as „skipped", not an error.
  if (failures.length === sources.length) {
    throw new Error(failures.join("; "));
  }
  return Array.from(found);
}
