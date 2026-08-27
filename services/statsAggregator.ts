import { NotionBook } from "../src/types";

/**
 * Pure stats aggregations: `books[] → stat`. Extracted from `StatsService.getStats`
 * (which had ~10 aggregations inlined in one ~200-line method) so each is a small,
 * testable function and the service is just fetch → filter → delegate → assemble.
 * `computeMarketStats` (marketStats.ts) already followed this pattern; these join it.
 *
 * Input is the award-scoped, non-empty-Polish-title book set the service prepares.
 * Logic here is verbatim — no behavior change.
 */

const isRead = (b: NotionBook) => (b.zrodlo || []).includes("Przeczytane");
const isOwned = (b: NotionBook) => (b.zrodlo || []).includes("Posiadam");
/** First 4-digit year of a (possibly multi-dated) field; missing → 9999 (sorts last). */
const firstYearNum = (year?: string | null) => parseInt((year ?? "").toString().split(",")[0] || "9999");

export function computeAuthorStats(books: NotionBook[]) {
  const authorStats: Record<string, { read: number; total: number; books: any[] }> = {};
  books.forEach((book) => {
    if (!book.author) return;
    const authors = book.author.split(",").map((a: string) => a.trim());
    authors.forEach((author) => {
      if (!authorStats[author]) authorStats[author] = { read: 0, total: 0, books: [] };
      authorStats[author].total++;
      const read = isRead(book);
      if (read) authorStats[author].read++;
      authorStats[author].books.push({ id: book.id, title: book.plTitle || book.origTitle, year: book.year, read });
    });
  });
  Object.values(authorStats).forEach((stat) => {
    stat.books.sort((a, b) => firstYearNum(a.year) - firstYearNum(b.year));
  });
  return Object.entries(authorStats)
    .map(([name, stats]) => ({ name, ...stats }))
    .sort((a, b) => b.read - a.read)
    .slice(0, 15); // Top 15 authors
}

export function computeAwardBooksStats(books: NotionBook[]) {
  return { read: books.filter(isRead).length, total: books.length };
}

export function computeOwnedUnread(books: NotionBook[]) {
  return books
    .filter((b) => (b.zrodlo || []).includes("Posiadam") && !(b.zrodlo || []).includes("Przeczytane"))
    .map((b) => ({ id: b.id, title: b.plTitle || b.origTitle, author: b.author, year: b.year }))
    .sort((a, b) => firstYearNum(a.year) - firstYearNum(b.year));
}

export function computeAwardCoverage(books: NotionBook[]) {
  const awardCoverage: Record<string, { count: number; total: number }> = {};
  books.forEach((book) => {
    (book.awards || []).forEach((nagroda) => {
      if (!awardCoverage[nagroda]) awardCoverage[nagroda] = { count: 0, total: books.length };
      awardCoverage[nagroda].count++;
    });
  });
  return Object.entries(awardCoverage)
    .map(([name, stats]) => ({ name, ...stats }))
    .sort((a, b) => b.count - a.count);
}

export function computeAllAwardsStats(books: NotionBook[]) {
  const allAwardsBooks = books.filter((b) => (b.awards || []).includes("Wszystkie"));
  return { read: allAwardsBooks.filter(isRead).length, total: allAwardsBooks.length };
}

/**
 * Aggregate availability of UNREAD books — one "where to get it" counter combining
 * ownership / libraries (branch tags) / Vinted (offers blob). Priority partition
 * (owned > library > Vinted > no trace) — each book counted once.
 */
export function computeAvailabilityStats(books: NotionBook[], branchTags: Set<string>, hasVintedOffers: (raw?: string) => boolean) {
  const availability = { owned: 0, library: 0, vinted: 0, none: 0 };
  let totalUnread = 0;
  books.forEach((book) => {
    const zr = book.zrodlo || [];
    if (zr.includes("Przeczytane")) return;
    totalUnread++;
    if (zr.includes("Posiadam")) availability.owned++;
    else if (zr.some((z) => branchTags.has(z))) availability.library++;
    else if (hasVintedOffers(book.vintedData)) availability.vinted++;
    else availability.none++;
  });
  return { totalUnread, ...availability };
}

export function computePublisherStats(books: NotionBook[]) {
  const publisherMap: Record<string, { count: number; read: number }> = {};
  books.forEach((book) => {
    const pub = (book.currentWydawnictwo || "").trim();
    if (!pub) return;
    if (!publisherMap[pub]) publisherMap[pub] = { count: 0, read: 0 };
    publisherMap[pub].count++;
    if (isRead(book)) publisherMap[pub].read++;
  });
  return Object.entries(publisherMap)
    .map(([name, s]) => ({ name, ...s }))
    .sort((a, b) => b.count - a.count || a.name.localeCompare(b.name, "pl"))
    .slice(0, 15);
}

export function computeSeriesStats(books: NotionBook[]) {
  const seriesMap: Record<string, { count: number; owned: number; read: number }> = {};
  books.forEach((book) => {
    const ser = (book.currentSeria || "").trim();
    if (!ser) return;
    if (!seriesMap[ser]) seriesMap[ser] = { count: 0, owned: 0, read: 0 };
    seriesMap[ser].count++;
    if (isOwned(book)) seriesMap[ser].owned++;
    if (isRead(book)) seriesMap[ser].read++;
  });
  return Object.entries(seriesMap)
    .map(([name, s]) => ({ name, ...s }))
    .sort((a, b) => b.count - a.count || a.name.localeCompare(b.name, "pl"))
    .slice(0, 15);
}

export function computeCycleStats(books: NotionBook[]) {
  const cyclePart = books.filter((b) => b.currentCzesccyklu === true).length;
  return { partOfCycle: cyclePart, standalone: books.length - cyclePart, total: books.length };
}

export function computeDecadeStats(books: NotionBook[]) {
  const decadeMap: Record<number, { total: number; read: number; owned: number }> = {};
  books.forEach((book) => {
    const m = (book.year || "").toString().match(/\d{4}/);
    if (!m) return;
    const dec = Math.floor(parseInt(m[0], 10) / 10) * 10;
    if (!decadeMap[dec]) decadeMap[dec] = { total: 0, read: 0, owned: 0 };
    decadeMap[dec].total++;
    if (isRead(book)) decadeMap[dec].read++;
    if (isOwned(book)) decadeMap[dec].owned++;
  });
  return Object.entries(decadeMap)
    .map(([decade, s]) => ({ decade: parseInt(decade, 10), ...s }))
    .sort((a, b) => a.decade - b.decade);
}

export function computeYearlyStats(books: NotionBook[]) {
  const yearlyStats: Record<string, { read: number; total: number; books: any[] }> = {};
  books.forEach((book) => {
    if (!book.year) return;
    const years = book.year.toString().split(",").map((y) => y.trim()).filter(Boolean);
    years.forEach((year) => {
      if (!yearlyStats[year]) yearlyStats[year] = { read: 0, total: 0, books: [] };
      yearlyStats[year].total++;
      const read = isRead(book);
      if (read) yearlyStats[year].read++;
      yearlyStats[year].books.push({ id: book.id, title: book.plTitle || book.origTitle, author: book.author, read });
    });
  });
  return Object.entries(yearlyStats)
    .map(([year, stats]) => ({ year, ...stats }))
    .sort((a, b) => parseInt(a.year) - parseInt(b.year));
}

export function computeLibraryStats(books: NotionBook[], branches: { sourceTag: string; name: string }[]) {
  // Branches from config (`library.branches`) — adding a branch in Kalibracja immediately
  // shows up. `id` = the branch's „Źródło" tag (matched by the marker).
  return branches.map((branch) => ({
    id: branch.sourceTag,
    name: branch.name,
    books: books
      .filter((b) => (b.zrodlo || []).includes(branch.sourceTag))
      .map((b) => ({ id: b.id, title: b.plTitle || b.origTitle, author: b.author, year: b.year, read: (b.zrodlo || []).includes("Przeczytane") }))
      .sort((a, b) => firstYearNum(a.year) - firstYearNum(b.year)),
  }));
}
