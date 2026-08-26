import pLimit from "p-limit";
import { NotionAdapter } from "../notion.adapter";
import { WikiAdapter } from "../wiki.adapter";
import { WikiParser } from "../wiki.parser";
import { NotionBook, SyncEvent } from "../src/types";
import { normalizeData, isWikiAuthorMatch, NormalizationContext } from "./dataNormalizer";
import { DiffEngine } from "./diffEngine";
import { isAwardBook } from "./bookCategory";

/**
 * Config for a single field enriched from a book's encyclopedia page.
 * PublisherSyncService and SeriesSyncService are just two instances of the same
 * pipeline (fetch → author verification → diff → update), differing only in the field.
 */
export interface WikiFieldConfig {
  /** Notion column, e.g. "Wydawnictwo" / "Seria". */
  notionColumn: string;
  /** Picks the field from the parser result. */
  pick: (extracted: { wydawca: string; seria: string }) => string;
  /** Normalization context for dataNormalizer. */
  normalizeContext: NormalizationContext;
  /** Reads the current value from the Notion record. */
  current: (book: NotionBook) => string;
  /** Ritual name (for the cancellation message). */
  ritualName: string;
  /** Label for the progress message (genitive, e.g. "wydawnictw"). */
  progressLabel: string;
  /** Label for the summary (e.g. "Wydawnictwo"). */
  summaryLabel: string;
}

/**
 * Shared pipeline for syncing a single field (publisher/series) from book
 * pages. Replaces the duplicated Publisher/SeriesSyncService.
 */
export class WikiFieldSyncService {
  constructor(
    private notion: NotionAdapter,
    private wiki: WikiAdapter,
    private config: WikiFieldConfig
  ) {}

  async run(sendEvent: (data: SyncEvent) => void, checkCancellation: () => boolean) {
    const cfg = this.config;
    try {
      sendEvent({ type: "status", message: "Pobieranie listy książek z Notion..." });
      const rawBooks: NotionBook[] = await this.notion.queryAllBooks(
        (count) => sendEvent({ type: "status", message: `Pobrano ${count} książek z Notion...` }),
        checkCancellation
      );
      // Publisher/series enrichment is an AWARD concern — side cycle volumes
      // (Kategoria="Tom cyklu") have their own harvest ritual and „Archiwum Cykli" view,
      // so we skip them (no needless page fetches and writes on rows
      // that no award consumer reads).
      const allBooks = rawBooks.filter(isAwardBook);

      if (checkCancellation()) { sendEvent({ type: "status", message: `Przerwano ${cfg.ritualName}.` }); return; }

      const titlesToFetch = Array.from(new Set(allBooks.map(b => b.plTitle || b.origTitle).filter(Boolean))) as string[];

      sendEvent({ type: "status", message: `Pobieranie treści ${titlesToFetch.length} stron z Encyklopedii (Bulk API)...` });
      const { contents: wikiContents, failedTitles } = await this.wiki.fetchPagesContentBulk(titlesToFetch);

      let processedCount = 0, updatedCount = 0;
      const syncSummary = { added: [] as string[], updated: [] as string[] };
      const errors: { book: string; error: string }[] = [];
      if (failedTitles.length > 0) {
        errors.push({ book: `${failedTitles.length} stron`, error: `Nie udało się pobrać treści z encyklopedii (książki pominięte): ${failedTitles.slice(0, 5).join(", ")}${failedTitles.length > 5 ? "…" : ""}` });
      }

      const limit = pLimit(3);

      const syncTasks = allBooks.map((book) => limit(async () => {
        if (checkCancellation()) return;

        processedCount++;
        if (processedCount % 10 === 0 || processedCount === allBooks.length) {
          sendEvent({ type: "progress", message: `Analiza i aktualizacja ${cfg.progressLabel} (In-Memory Diff)...`, current: processedCount, total: allBooks.length });
        }

        const titleToSearch = book.plTitle || book.origTitle;
        if (!titleToSearch) return;

        try {
          const wikitext = wikiContents[titleToSearch.toLowerCase()];
          if (!wikitext) return;

          // Verify the author — a page with the same title may concern a different work
          const wikiAuthor = WikiParser.extractAuthor(wikitext);
          if (!isWikiAuthorMatch(wikiAuthor, book.author || "")) return;

          const extracted = WikiParser.extractPublisherAndSeries(wikitext);
          const value = normalizeData(cfg.pick(extracted), cfg.normalizeContext);

          const updates: Record<string, unknown> = {};
          const currentValue = (cfg.current(book) || "").trim();

          if (value && !DiffEngine.isMultiSelectEqual(value, currentValue)) {
            updates[cfg.notionColumn] = this.notion.buildPropertyValue(value, "multi_select");
          }

          if (Object.keys(updates).length > 0) {
            await this.notion.updatePage(book.id, updates);
            updatedCount++;
            syncSummary.updated.push(`${titleToSearch} (${cfg.summaryLabel}: ${value})`);
          }
        } catch (err: any) {
          errors.push({ book: titleToSearch, error: err.message });
        }
      }));

      await Promise.all(syncTasks);

      sendEvent({ type: "complete", result: { found: allBooks.length, synced: 0, updated: updatedCount, summary: syncSummary, errors: errors.map(e => `${e.book}: ${e.error}`) } });
    } catch (error: any) {
      sendEvent({ type: "error", error: error.message });
    }
  }
}

export const PUBLISHER_FIELD: WikiFieldConfig = {
  notionColumn: "Wydawnictwo",
  pick: (e) => e.wydawca,
  normalizeContext: "publisher",
  current: (b) => b.currentWydawnictwo || "",
  ritualName: "Rytuał Wydania",
  progressLabel: "wydawnictw",
  summaryLabel: "Wydawnictwo",
};

export const SERIES_FIELD: WikiFieldConfig = {
  notionColumn: "Seria",
  pick: (e) => e.seria,
  normalizeContext: "series",
  current: (b) => b.currentSeria || "",
  ritualName: "Rytuał Seryjny",
  progressLabel: "serii",
  summaryLabel: "Seria",
};
