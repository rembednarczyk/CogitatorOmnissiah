import { NotionAdapter } from "../notion.adapter";
import { ConfigService } from "./configService";
import { parseVintedData } from "./vintedStore";
import { computeMarketStats } from "./marketStats";
import { isAwardBook } from "./bookCategory";
import {
  computeAuthorStats, computeAwardBooksStats, computeOwnedUnread, computeAwardCoverage,
  computeAllAwardsStats, computeAvailabilityStats, computePublisherStats, computeSeriesStats,
  computeCycleStats, computeDecadeStats, computeYearlyStats, computeLibraryStats,
  computeReadingStats,
} from "./statsAggregator";

export class StatsService {
  constructor(private notion: NotionAdapter, private config: ConfigService) {}

  async getStats() {
    let books = await this.notion.getBooksForStats();
    const branches = (await this.config.getConfig()).library.branches;

    // Global filter: only AWARD entries (side cycle volumes have their own view
    // in „Archiwum Cykli") and with a non-empty Polish title.
    books = books.filter(b => isAwardBook(b) && b.plTitle && b.plTitle.trim() !== "");

    const branchTags = new Set(branches.map(b => b.sourceTag));
    const hasVintedOffers = (raw?: string) => (parseVintedData(raw)?.offers.length ?? 0) > 0;

    return {
      authorStats: computeAuthorStats(books),
      awardBooksStats: computeAwardBooksStats(books),
      ownedUnread: computeOwnedUnread(books),
      awardCoverage: computeAwardCoverage(books),
      allAwardsStats: computeAllAwardsStats(books),
      yearlyStats: computeYearlyStats(books),
      availabilityStats: computeAvailabilityStats(books, branchTags, hasVintedOffers),
      publisherStats: computePublisherStats(books),
      seriesStats: computeSeriesStats(books),
      cycleStats: computeCycleStats(books),
      decadeStats: computeDecadeStats(books),
      readingStats: computeReadingStats(books),
      marketStats: computeMarketStats(books),
      libraryStats: computeLibraryStats(books, branches),
    };
  }
}
