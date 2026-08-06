import { NotionAdapter } from "../notion.adapter";

export class StatsService {
  constructor(private notion: NotionAdapter) {}

  async getStats() {
    let books = await this.notion.getBooksForStats();
    
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
      libraryStats: [
        {
          id: "Biblioteka",
          name: "Biblioteka Felin",
          books: books
            .filter(b => (b.zrodlo || []).includes("Biblioteka"))
            .map(b => ({ id: b.id, title: b.plTitle || b.origTitle, author: b.author, year: b.year, read: (b.zrodlo || []).includes("Przeczytane") }))
            .sort((a, b) => {
              const yearA = parseInt(a.year?.toString().split(',')[0] || "9999");
              const yearB = parseInt(b.year?.toString().split(',')[0] || "9999");
              return yearA - yearB;
            })
        },
        {
          id: "Biblioteka 9",
          name: "Biblioteka Bronowice",
          books: books
            .filter(b => (b.zrodlo || []).includes("Biblioteka 9"))
            .map(b => ({ id: b.id, title: b.plTitle || b.origTitle, author: b.author, year: b.year, read: (b.zrodlo || []).includes("Przeczytane") }))
            .sort((a, b) => {
              const yearA = parseInt(a.year?.toString().split(',')[0] || "9999");
              const yearB = parseInt(b.year?.toString().split(',')[0] || "9999");
              return yearA - yearB;
            })
        }
      ]
    };
  }
}
