import pLimit from "p-limit";
import { NotionAdapter } from "../notion.adapter";
import { WikiAdapter } from "../wiki.adapter";
import { WikiParser } from "../wiki.parser";
import { NotionBook, SyncEvent } from "../src/types";
import { normalizeData, isWikiAuthorMatch, NormalizationContext } from "./dataNormalizer";
import { DiffEngine } from "./diffEngine";

/**
 * Konfiguracja jednego pola wzbogacanego ze strony książki w encyklopedii.
 * PublisherSyncService i SeriesSyncService to tylko dwie instancje tego samego
 * potoku (fetch → weryfikacja autora → diff → update), różniące się polem.
 */
export interface WikiFieldConfig {
  /** Kolumna w Notion, np. "Wydawnictwo" / "Seria". */
  notionColumn: string;
  /** Wybiera pole z wyniku parsera. */
  pick: (extracted: { wydawca: string; seria: string }) => string;
  /** Kontekst normalizacji dla dataNormalizer. */
  normalizeContext: NormalizationContext;
  /** Odczytuje obecną wartość z rekordu Notion. */
  current: (book: NotionBook) => string;
  /** Nazwa rytuału (do komunikatu o przerwaniu). */
  ritualName: string;
  /** Etykieta do komunikatu progresu (dopełniacz, np. "wydawnictw"). */
  progressLabel: string;
  /** Etykieta do podsumowania (np. "Wydawnictwo"). */
  summaryLabel: string;
}

/**
 * Wspólny potok synchronizacji pojedynczego pola (wydawca/seria) ze stron
 * książek. Zastępuje zduplikowane Publisher/SeriesSyncService.
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
      const allBooks: NotionBook[] = await this.notion.queryAllBooks(
        (count) => sendEvent({ type: "status", message: `Pobrano ${count} książek z Notion...` }),
        checkCancellation
      );

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

          // Zweryfikuj autora — strona o tym samym tytule może dotyczyć innego dzieła
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
