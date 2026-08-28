import { robustBookKey } from "./bookMatch";
import { normalizeData } from "./dataNormalizer";

/**
 * Pure helpers for a one-time bulk import of read dates („Data przeczytania")
 * from an exported CSV (`tytul;autor;data_przeczytania;link`). No Notion access
 * here — these are testable pure functions; the runnable wrapper lives in
 * `scripts/importReadDates.ts`. Also the foundation for the future in-app CSV
 * import feature (backlog).
 *
 * Hard rule: matching is against books ALREADY in the base — the plan never
 * invents a row. Unmatched CSV entries are reported, not created.
 */

export type DatePrecision = "day" | "month" | "year";
export interface ParsedReadDate {
  /** Notion calendar day („YYYY-MM-DD"). Partial inputs snap to the period start. */
  iso: string;
  precision: DatePrecision;
}

function isValidYmd(y: number, m: number, d: number): boolean {
  if (m < 1 || m > 12 || d < 1 || d > 31) return false;
  const dt = new Date(Date.UTC(y, m - 1, d));
  return dt.getUTCFullYear() === y && dt.getUTCMonth() === m - 1 && dt.getUTCDate() === d;
}
const p2 = (n: number) => String(n).padStart(2, "0");
const p4 = (n: number) => String(n).padStart(4, "0");

/**
 * Recognizes the read-date formats seen in the export and normalizes each to a
 * Notion calendar day. Full dates keep their day; a month-only value snaps to
 * the 1st, a year-only value to Jan 1 (day/month granularity is approximate for
 * those — the velocity stats aggregate by month/year, so the period is what
 * matters). Returns `null` for anything unrecognized (so the caller can report it).
 *
 * Accepted: `dd.mm.yyyy`, `yyyy-mm-dd`, `yyyy-mm`, `mm.yyyy`, `yyyy`.
 */
export function parseReadDate(raw: string): ParsedReadDate | null {
  const s = (raw || "").trim();
  if (!s) return null;
  let m: RegExpMatchArray | null;

  if ((m = s.match(/^(\d{1,2})\.(\d{1,2})\.(\d{4})$/))) {
    const d = +m[1], mo = +m[2], y = +m[3];
    return isValidYmd(y, mo, d) ? { iso: `${p4(y)}-${p2(mo)}-${p2(d)}`, precision: "day" } : null;
  }
  if ((m = s.match(/^(\d{4})-(\d{2})-(\d{2})$/))) {
    const y = +m[1], mo = +m[2], d = +m[3];
    return isValidYmd(y, mo, d) ? { iso: `${m[1]}-${m[2]}-${m[3]}`, precision: "day" } : null;
  }
  if ((m = s.match(/^(\d{4})-(\d{1,2})$/))) {
    const y = +m[1], mo = +m[2];
    return mo >= 1 && mo <= 12 ? { iso: `${p4(y)}-${p2(mo)}-01`, precision: "month" } : null;
  }
  if ((m = s.match(/^(\d{1,2})\.(\d{4})$/))) {
    const mo = +m[1], y = +m[2];
    return mo >= 1 && mo <= 12 ? { iso: `${p4(y)}-${p2(mo)}-01`, precision: "month" } : null;
  }
  if ((m = s.match(/^(\d{4})$/))) {
    return { iso: `${m[1]}-01-01`, precision: "year" };
  }
  return null;
}

export interface ImportRow {
  tytul: string;
  autor: string;
  dataRaw: string;
  link: string;
}

/**
 * Parses the semicolon-delimited export (`tytul;autor;data_przeczytania;link`),
 * stripping a UTF-8 BOM and the header row. A field is never split further, so a
 * stray delimiter in the link column folds back into `link` (title/author/date
 * keep their fixed positions).
 */
export function parseImportCsv(content: string): ImportRow[] {
  const text = content.replace(/^﻿/, "");
  const rows: ImportRow[] = [];
  const lines = text.split(/\r?\n/);
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (line.trim() === "") continue;
    const parts = line.split(";");
    if (i === 0 && /^tytul$/i.test((parts[0] || "").trim())) continue; // header
    if (parts.length < 3) continue;
    rows.push({
      tytul: (parts[0] || "").trim(),
      autor: (parts[1] || "").trim(),
      dataRaw: (parts[2] || "").trim(),
      link: parts.slice(3).join(";").trim(),
    });
  }
  return rows;
}

/** Title-only normalization key — mirrors the title half of `robustBookKey`,
 *  used for the safe unique-title fallback match. */
export function bookTitleKey(title: string): string {
  return normalizeData(title || "", "title")
    .toLowerCase()
    .replace(/[.,/#!$%^&*;:{}=\-_`~()]/g, "")
    .replace(/\s{2,}/g, " ")
    .trim();
}

export interface MatchableBook {
  id: string;
  plTitle?: string;
  origTitle?: string;
  author?: string;
  /** Existing read date on the base row, if any (don't overwrite unless asked). */
  dataPrzeczytania?: string;
}

export interface ReadDateUpdate {
  id: string;
  iso: string;
  precision: DatePrecision;
  /** How the row was matched — for dry-run transparency. */
  matchedBy: "author+title" | "unique-title";
  /** The CSV title (for the report). */
  csvTitle: string;
  dateRaw: string;
}

export interface ImportPlan {
  /** Rows to write: one per matched base book, earliest read date kept. */
  updates: ReadDateUpdate[];
  /** Matched a base row that already has a date — skipped unless `overwrite`. */
  skippedExisting: ReadDateUpdate[];
  /** CSV rows with no book in the base (expected: non-award reads). */
  unmatched: ImportRow[];
  /** CSV rows whose date string was unrecognized. */
  unparseableDate: ImportRow[];
  /** CSV rows whose title matched >1 base book and author didn't disambiguate. */
  ambiguous: { row: ImportRow; bookIds: string[] }[];
  /** How many extra CSV rows collapsed onto an already-matched book (kept earliest). */
  collapsed: number;
}

function pushUnique(map: Map<string, Set<string>>, key: string, id: string) {
  if (!key) return;
  if (!map.has(key)) map.set(key, new Set());
  map.get(key)!.add(id);
}

/**
 * Builds the import plan: matches each CSV row to at most one existing base book
 * and resolves the read date. Two-tier matching, strictly non-inventive:
 *   1. exact `robustBookKey` (author + title, on plTitle or origTitle);
 *   2. fallback on a UNIQUE normalized title (catches author-format drift) —
 *      only when that title maps to exactly one base book, so it can never
 *      mis-assign a date across two different books.
 * When several CSV rows map to one book, the earliest date wins (first read).
 */
export function buildReadDatePlan(
  rows: ImportRow[],
  books: MatchableBook[],
  opts: { overwrite: boolean } = { overwrite: false },
): ImportPlan {
  // Indexes over the base.
  const exactIndex = new Map<string, Set<string>>(); // robustBookKey -> bookIds
  const titleIndex = new Map<string, Set<string>>(); // titleKey     -> bookIds
  const byId = new Map<string, MatchableBook>();
  for (const b of books) {
    byId.set(b.id, b);
    if (b.plTitle) {
      pushUnique(exactIndex, robustBookKey(b.author || "", b.plTitle), b.id);
      pushUnique(titleIndex, bookTitleKey(b.plTitle), b.id);
    }
    if (b.origTitle) {
      pushUnique(exactIndex, robustBookKey(b.author || "", b.origTitle), b.id);
      pushUnique(titleIndex, bookTitleKey(b.origTitle), b.id);
    }
  }

  const unmatched: ImportRow[] = [];
  const unparseableDate: ImportRow[] = [];
  const ambiguous: { row: ImportRow; bookIds: string[] }[] = [];
  // bookId -> best (earliest) candidate so far
  const best = new Map<string, ReadDateUpdate>();
  let collapsed = 0;

  for (const row of rows) {
    const parsed = parseReadDate(row.dataRaw);
    if (!parsed) { unparseableDate.push(row); continue; }

    let ids: string[] = [];
    let matchedBy: ReadDateUpdate["matchedBy"] = "author+title";

    const exactKey = robustBookKey(row.autor, row.tytul);
    const exact = exactKey ? exactIndex.get(exactKey) : undefined;
    if (exact && exact.size >= 1) {
      ids = [...exact];
      matchedBy = "author+title";
    } else {
      const tk = bookTitleKey(row.tytul);
      const byTitle = tk ? titleIndex.get(tk) : undefined;
      if (byTitle && byTitle.size >= 1) { ids = [...byTitle]; matchedBy = "unique-title"; }
    }

    if (ids.length === 0) { unmatched.push(row); continue; }
    if (ids.length > 1) { ambiguous.push({ row, bookIds: ids }); continue; }

    const id = ids[0];
    const candidate: ReadDateUpdate = {
      id, iso: parsed.iso, precision: parsed.precision, matchedBy, csvTitle: row.tytul, dateRaw: row.dataRaw,
    };
    const prev = best.get(id);
    if (!prev) {
      best.set(id, candidate);
    } else {
      collapsed++;
      // Keep the earliest read date (first time read).
      if (candidate.iso < prev.iso) best.set(id, candidate);
    }
  }

  // Split matched books into writable vs. skipped (already dated, no overwrite).
  const updates: ReadDateUpdate[] = [];
  const skippedExisting: ReadDateUpdate[] = [];
  for (const u of best.values()) {
    const existing = byId.get(u.id)?.dataPrzeczytania;
    if (existing && !opts.overwrite) skippedExisting.push(u);
    else updates.push(u);
  }

  return { updates, skippedExisting, unmatched, unparseableDate, ambiguous, collapsed };
}
