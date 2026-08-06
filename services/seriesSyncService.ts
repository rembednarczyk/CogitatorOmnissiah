import pLimit from "p-limit";
import { NotionAdapter } from "../notion.adapter";
import { WikiAdapter } from "../wiki.adapter";
import { WikiParser } from "../wiki.parser";
import { NotionBook, SyncEvent } from "../src/types";
import { normalizeData } from "./dataNormalizer";
import { DiffEngine } from "./diffEngine";

export class SeriesSyncService {
  constructor(private notion: NotionAdapter, private wiki: WikiAdapter) {}

  async runSeriesSync(sendEvent: (data: SyncEvent) => void, checkCancellation: () => boolean) {
    try {
      sendEvent({ type: "status", message: "Pobieranie listy książek z Notion..." });
      const allBooks: NotionBook[] = await this.notion.queryAllBooks((count) => sendEvent({ type: "status", message: `Pobrano ${count} książek z Notion...` }), checkCancellation);
      
      if (checkCancellation()) { sendEvent({ type: "status", message: "Przerwano Rytuał Seryjny." }); return; }

      const titlesToFetch = Array.from(new Set(allBooks.map(b => b.plTitle || b.origTitle).filter(Boolean))) as string[];
      
      sendEvent({ type: "status", message: `Pobieranie treści ${titlesToFetch.length} stron z Encyklopedii (Bulk API)...` });
      const wikiContents = await this.wiki.fetchPagesContentBulk(titlesToFetch);

      let processedCount = 0, updatedCount = 0;
      const syncSummary = { added: [] as string[], updated: [] as string[] };
      const errors: any[] = [];
      
      const seriaPropType = "multi_select";
      const limit = pLimit(3);

      const syncTasks = allBooks.map((book) => limit(async () => {
        if (checkCancellation()) return;
        
        processedCount++;
        if (processedCount % 10 === 0 || processedCount === allBooks.length) {
          sendEvent({ type: "progress", message: "Analiza i aktualizacja serii (In-Memory Diff)...", current: processedCount, total: allBooks.length });
        }
        
        const titleToSearch = book.plTitle || book.origTitle;
        if (!titleToSearch) return;
        
        try {
          const wikitext = wikiContents[titleToSearch.toLowerCase()];
          if (!wikitext) return;

          const extracted = WikiParser.extractPublisherAndSeries(wikitext);
          let seria = extracted.seria;
          
          seria = normalizeData(seria, 'series');
          
          const updates: any = {};
          const currentSer = (book.currentSeria || "").trim();
          
          if (seria && !DiffEngine.isMultiSelectEqual(seria, currentSer)) {
            updates["Seria"] = this.notion.buildPropertyValue(seria, seriaPropType);
          }
          
          if (Object.keys(updates).length > 0) {
            await this.notion.updatePage(book.id, updates);
            updatedCount++;
            syncSummary.updated.push(`${titleToSearch} (Seria: ${seria})`);
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
