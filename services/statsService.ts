import { NotionAdapter } from "../notion.adapter";
import { ConfigService } from "./configService";
import { parseVintedData } from "./vintedStore";

export class StatsService {
  constructor(private notion: NotionAdapter, private config: ConfigService) {}

  async getStats() {
    let books = await this.notion.getBooksForStats();
    const branches = (await this.config.getConfig()).library.branches;

    // Global filter: only books with a non-empty Polish title
    books = books.filter(b => b.plTitle && b.plTitle.trim() !== "");
    
    // 1. Author progress
    const authorStats: Record<string, { read: number; total: number; books: any[] }> = {};
    books.forEach(book => {
      if (!book.author) return;
      const authors = book.author.split(',').map((a: string) => a.trim());
      authors.forEach(author => {
        if (!authorStats[author]) authorStats[author] = { read: 0, total: 0, books: [] };
        authorStats[author].total++;
        const isRead = (book.zrodlo || []).includes("Przeczytane");
        if (isRead) {
          authorStats[author].read++;
        }
        authorStats[author].books.push({
          id: book.id,
          title: book.plTitle || book.origTitle,
          year: book.year,
          read: isRead
        });
      });
    });

    // Sort books for each author by year
    Object.values(authorStats).forEach(stat => {
      stat.books.sort((a, b) => {
        const yearA = parseInt(a.year?.toString().split(',')[0] || "9999");
        const yearB = parseInt(b.year?.toString().split(',')[0] || "9999");
        return yearA - yearB;
      });
    });

    // 2. Award books progress
    const awardBooksRead = books.filter(b => (b.zrodlo || []).includes("Przeczytane")).length;
    const awardBooksStats = { read: awardBooksRead, total: books.length };

    // 3. Owned but unread
    const ownedUnread = books
      .filter(b => (b.zrodlo || []).includes("Posiadam") && !(b.zrodlo || []).includes("Przeczytane"))
      .map(b => ({ id: b.id, title: b.plTitle || b.origTitle, author: b.author, year: b.year }));

    // 4. Award coverage progress
    const awardCoverage: Record<string, { count: number; total: number }> = {};
    books.forEach(book => {
      (book.awards || []).forEach(nagroda => {
        if (!awardCoverage[nagroda]) awardCoverage[nagroda] = { count: 0, total: books.length };
        awardCoverage[nagroda].count++;
      });
    });

    // 5. "All" awards progress (Przeczytane for books with "Wszystkie" tag)
    const allAwardsBooks = books.filter(b => (b.awards || []).includes("Wszystkie"));
    const allAwardsRead = allAwardsBooks.filter(b => (b.zrodlo || []).includes("Przeczytane")).length;
    const allAwardsStats = { read: allAwardsRead, total: allAwardsBooks.length };

    // 5b. Aggregate availability of UNREAD books — jeden „skąd zdobyć" licznik łączący
    // posiadanie / biblioteki (tagi filii z konfiguracji) / Vinted (blob ofert). Partycja
    // priorytetowa (posiadane > biblioteka > Vinted > brak śladu) — każda książka liczona raz.
    const branchTags = new Set(branches.map(b => b.sourceTag));
    const hasVintedOffers = (raw?: string) => (parseVintedData(raw)?.offers.length ?? 0) > 0;
    const availability = { owned: 0, library: 0, vinted: 0, none: 0 };
    let totalUnread = 0;
    books.forEach(book => {
      const zr = book.zrodlo || [];
      if (zr.includes("Przeczytane")) return;
      totalUnread++;
      if (zr.includes("Posiadam")) availability.owned++;
      else if (zr.some(z => branchTags.has(z))) availability.library++;
      else if (hasVintedOffers(book.vintedData)) availability.vinted++;
      else availability.none++;
    });
    const availabilityStats = { totalUnread, ...availability };

    // 6. Yearly progress
    const yearlyStats: Record<string, { read: number; total: number; books: any[] }> = {};
    books.forEach(book => {
      if (!book.year) return;
      const years = book.year.toString().split(',').map(y => y.trim()).filter(Boolean);
      years.forEach(year => {
        if (!yearlyStats[year]) yearlyStats[year] = { read: 0, total: 0, books: [] };
        yearlyStats[year].total++;
        const isRead = (book.zrodlo || []).includes("Przeczytane");
        if (isRead) {
          yearlyStats[year].read++;
        }
        yearlyStats[year].books.push({
          id: book.id,
          title: book.plTitle || book.origTitle,
          author: book.author,
          read: isRead
        });
      });
    });

    return {
      authorStats: Object.entries(authorStats)
        .map(([name, stats]) => ({ name, ...stats }))
        .sort((a, b) => b.read - a.read)
        .slice(0, 15), // Top 15 authors
      awardBooksStats,
      ownedUnread: ownedUnread
        .sort((a, b) => {
          const yearA = parseInt(a.year?.toString().split(',')[0] || "9999");
          const yearB = parseInt(b.year?.toString().split(',')[0] || "9999");
          return yearA - yearB;
        }),
      awardCoverage: Object.entries(awardCoverage)
        .map(([name, stats]) => ({ name, ...stats }))
        .sort((a, b) => b.count - a.count),
      allAwardsStats,
      yearlyStats: Object.entries(yearlyStats)
        .map(([year, stats]) => ({ year, ...stats }))
        .sort((a, b) => parseInt(a.year) - parseInt(b.year)),
      availabilityStats,
      // Filie z konfiguracji (`library.branches`) — dopisanie 3. filii w Kalibracji od razu
      // pojawia się w statystykach. `id` = tag „Źródło" filii (dopasowanie po znaczniku).
      libraryStats: branches.map(branch => ({
        id: branch.sourceTag,
        name: branch.name,
        books: books
          .filter(b => (b.zrodlo || []).includes(branch.sourceTag))
          .map(b => ({ id: b.id, title: b.plTitle || b.origTitle, author: b.author, year: b.year, read: (b.zrodlo || []).includes("Przeczytane") }))
          .sort((a, b) => {
            const yearA = parseInt(a.year?.toString().split(',')[0] || "9999");
            const yearB = parseInt(b.year?.toString().split(',')[0] || "9999");
            return yearA - yearB;
          })
      }))
    };
  }
}
