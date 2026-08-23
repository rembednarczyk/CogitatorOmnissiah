import { NotionBook } from "../src/types";
import { parseVintedData } from "./vintedStore";

/** Znaczniki „Źródło" wykluczające książkę ze skanu (już mamy / czytamy). */
export const EXCLUDED_SOURCES = ["Posiadam", "Przeczytane", "Audioteka", "Biblioteka", "Biblioteka 9"];

/** Czas ostatniego skanu książki w ms; nigdy-skanowane = -Infinity (najstarsze → najwyższy priorytet). */
export function scannedMs(book: NotionBook): number {
  const at = parseVintedData(book.vintedData)?.scannedAt;
  const t = at ? Date.parse(at) : NaN;
  return isNaN(t) ? -Infinity : t;
}

export interface ScanPlan {
  candidates: NotionBook[];
  /** Ile pominięto przez okno „Kontynuuj" (skanowane < N h). */
  skipped: number;
}

/**
 * Czysty plan skanu: (1) odsiej niekandydatów (wykluczone źródła / brak tytułu PL),
 * (2) opcjonalnie pomiń skanowane w ostatnich `skipScannedWithinHours` (bieżąca partia),
 * (3) posortuj OD NAJSTARSZYCH (nigdy-skanowane pierwsze) — przerwany przebieg zawsze
 * posuwa najbardziej nieaktualne dane, a „Kontynuuj" domyka partię zamiast dublować świeże.
 * `now` wstrzykiwalny dla testów.
 */
export function selectAndOrderCandidates(
  books: NotionBook[],
  skipScannedWithinHours?: number,
  now: number = Date.now(),
): ScanPlan {
  const base = books.filter((b) => {
    const zrodlo = b.zrodlo || [];
    return !zrodlo.some((z) => EXCLUDED_SOURCES.includes(z)) && !!b.plTitle && b.plTitle.trim() !== "";
  });

  let withDates = base.map((b) => ({ book: b, at: scannedMs(b) }));
  let skipped = 0;
  if (skipScannedWithinHours && skipScannedWithinHours > 0) {
    const cutoff = now - skipScannedWithinHours * 3_600_000;
    const before = withDates.length;
    withDates = withDates.filter((x) => x.at < cutoff); // -Infinity (nigdy) też przechodzi
    skipped = before - withDates.length;
  }

  withDates.sort((a, b) => a.at - b.at);
  return { candidates: withDates.map((x) => x.book), skipped };
}
