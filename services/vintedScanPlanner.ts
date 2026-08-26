import { NotionBook } from "../src/types";
import { parseVintedData } from "./vintedStore";

/** „Źródło" markers that exclude a book from the scan (already have / reading). */
export const EXCLUDED_SOURCES = ["Posiadam", "Przeczytane", "Audioteka", "Biblioteka", "Biblioteka 9"];

/** Last scan time of a book in ms; never-scanned = -Infinity (oldest → highest priority). */
export function scannedMs(book: NotionBook): number {
  const at = parseVintedData(book.vintedData)?.scannedAt;
  const t = at ? Date.parse(at) : NaN;
  return isNaN(t) ? -Infinity : t;
}

export interface ScanPlan {
  candidates: NotionBook[];
  /** How many were skipped by the „Kontynuuj" window (scanned < N h ago). */
  skipped: number;
}

/**
 * Pure scan plan: (1) filter out non-candidates (excluded sources / no PL title),
 * (2) optionally skip ones scanned within the last `skipScannedWithinHours` (current batch),
 * (3) sort OLDEST-FIRST (never-scanned first) — an interrupted run always
 * advances the most stale data, and „Kontynuuj" closes out the batch instead of re-doing fresh ones.
 * `now` injectable for tests; `excludedSources` from config (default = the existing list).
 */
export function selectAndOrderCandidates(
  books: NotionBook[],
  skipScannedWithinHours?: number,
  now: number = Date.now(),
  excludedSources: string[] = EXCLUDED_SOURCES,
): ScanPlan {
  const base = books.filter((b) => {
    const zrodlo = b.zrodlo || [];
    return !zrodlo.some((z) => excludedSources.includes(z)) && !!b.plTitle && b.plTitle.trim() !== "";
  });

  let withDates = base.map((b) => ({ book: b, at: scannedMs(b) }));
  let skipped = 0;
  if (skipScannedWithinHours && skipScannedWithinHours > 0) {
    const cutoff = now - skipScannedWithinHours * 3_600_000;
    const before = withDates.length;
    withDates = withDates.filter((x) => x.at < cutoff); // -Infinity (never) passes too
    skipped = before - withDates.length;
  }

  withDates.sort((a, b) => a.at - b.at);
  return { candidates: withDates.map((x) => x.book), skipped };
}
