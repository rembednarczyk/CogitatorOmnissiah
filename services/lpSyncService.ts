import { NotionAdapter } from "../notion.adapter";
import pLimit from "p-limit";
import { NotionBook, SyncEvent } from "../src/types";
import { isAwardBook } from "./bookCategory";
import { createLogger } from "../logger";

const log = createLogger("LpSync");

export class LpSyncService {
  constructor(private notion: NotionAdapter) {}

  async runLpSync(sendEvent: (data: SyncEvent) => void, checkCancellation: () => boolean) {
    try {
      sendEvent({ type: "status", message: "Pobieranie listy książek z Notion..." });
      let allBooks: NotionBook[] = await this.notion.queryAllBooks((count) => sendEvent({ type: "status", message: `Pobrano ${count} książek z Notion...` }), checkCancellation);
      
      // Filter out empty books (ghost rows) to avoid assigning Lp to them.
      // Lp numbering applies ONLY to award entries — side cycle volumes don't
      // participate in the global ordinal number (they don't shift award numbers;
      // their order within a cycle comes from the CyklNr field).
      allBooks = allBooks.filter(b => isAwardBook(b) && (b.plTitle || b.origTitle || b.author));

      if (checkCancellation()) { sendEvent({ type: "error", error: "Przerwano aktualizację Lp." }); return; }
      sendEvent({ type: "status", message: "Sortowanie i aktualizacja kolumny Lp..." });
      allBooks.sort((a, b) => {
        const yearA = parseInt(a.year || "0") || 0, yearB = parseInt(b.year || "0") || 0;
        if (yearA !== yearB) return yearA - yearB;
        return (a.plTitle || a.origTitle || "").localeCompare(b.plTitle || b.origTitle || "");
      });
      let updatedCount = 0, processedCount = 0;
      const syncSummary = { added: [] as string[], updated: [] as string[] };
      const limit = pLimit(3);
      const updateTasks = allBooks.map((book, i) => limit(async () => {
        if (checkCancellation()) return;
        const expectedLp = (i + 1).toString();
        if ((book as any).lp !== expectedLp) {
          try {
            await this.notion.updateLp(book.id, expectedLp);
            updatedCount++;
            syncSummary.updated.push(`${book.plTitle || book.origTitle} (Zaktualizowano: Lp -> ${expectedLp})`);
          } catch (err: any) { log.error(`Błąd Lp dla ${book.plTitle}`, { title: book.plTitle, error: err.message }); }
        }
        processedCount++;
        if (processedCount % 10 === 0 || processedCount === allBooks.length) {
          sendEvent({ type: "progress", message: "Aktualizacja numeracji (Lp)...", current: processedCount, total: allBooks.length });
        }
      }));
      await Promise.all(updateTasks);
      sendEvent({ type: "complete", result: { success: !checkCancellation(), found: allBooks.length, updated: updatedCount, summary: syncSummary } });
    } catch (error: any) { sendEvent({ type: "error", error: error.message }); }
  }
}
