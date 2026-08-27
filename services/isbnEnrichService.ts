import pLimit from "p-limit";
import { NotionAdapter } from "../notion.adapter";
import { NotionBook, SyncEvent } from "../src/types";
import { lookupIsbnByTitle } from "./isbnLookupService";
import { isAwardBook } from "./bookCategory";
import { createLogger } from "../logger";

const log = createLogger("IsbnEnrich");

/**
 * Enrichment ritual for the barcode "variant B": fills the „ISBN" column on award
 * books that lack one, by looking the book up on Google Books by title (+ author).
 * A stored canonical ISBN-13 lets a mobile scan match a row DIRECTLY, without any
 * on-scan external call.
 *
 * Caveat (see backlog): a title has many edition ISBNs; we store ONE "best match"
 * from Google Books, which often differs from the physical copy in hand — so the
 * scan flow keeps variant A (resolve → fuzzy search) as its safety net.
 *
 * Idempotent: books that already carry an ISBN are skipped, so re-running only fills
 * the gaps. Cycle sibling volumes are excluded — barcode lookup is an award concern.
 */
export class IsbnEnrichService {
  constructor(private notion: NotionAdapter) {}

  async runIsbnEnrich(sendEvent: (data: SyncEvent) => void, checkCancellation: () => boolean) {
    try {
      sendEvent({ type: "status", message: "Pobieranie listy książek z Notion..." });
      const rawBooks: NotionBook[] = await this.notion.queryAllBooks(
        (count) => sendEvent({ type: "status", message: `Pobrano ${count} książek z Notion...` }),
        checkCancellation
      );

      if (checkCancellation()) { sendEvent({ type: "status", message: "Przerwano Rytuał Sygnatur." }); return; }

      // Award books only, and only those still missing an ISBN (idempotent gap-fill).
      const targets = rawBooks
        .filter(isAwardBook)
        .filter((b) => !(b.isbn && b.isbn.trim().length > 0))
        .filter((b) => (b.plTitle && b.plTitle.trim()) || (b.origTitle && b.origTitle.trim()));

      const alreadyHave = rawBooks.filter(isAwardBook).length - targets.length;

      // Make sure the column exists before any write (schema ritual may not have run).
      await this.notion.createColumnIfNeeded("ISBN", "rich_text");

      let processedCount = 0, updatedCount = 0;
      const summary = { updated: [] as string[], skipped: [] as string[] };
      const errors: { book: string; error: string }[] = [];

      const limit = pLimit(3);

      const tasks = targets.map((book) => limit(async () => {
        if (checkCancellation()) return;

        processedCount++;
        if (processedCount % 10 === 0 || processedCount === targets.length) {
          sendEvent({ type: "progress", message: "Nadawanie Sygnatur (ISBN) z Google Books...", current: processedCount, total: targets.length });
        }

        // Prefer the original title for the lookup (Google Books indexes originals better),
        // fall back to the Polish title.
        const title = book.origTitle?.trim() || book.plTitle?.trim() || "";
        const label = book.plTitle || book.origTitle || book.id;
        if (!title) return;

        try {
          const isbn = await lookupIsbnByTitle(title, book.author);
          if (!isbn) {
            summary.skipped.push(label);
            return;
          }
          await this.notion.updatePage(book.id, { "ISBN": this.notion.buildPropertyValue(isbn, "rich_text") });
          updatedCount++;
          summary.updated.push(`${label} (ISBN: ${isbn})`);
        } catch (err: any) {
          log.warn("Błąd wzbogacania ISBN", { book: label, error: err?.message });
          errors.push({ book: label, error: err?.message || "nieznany błąd" });
        }
      }));

      await Promise.all(tasks);

      sendEvent({
        type: "complete",
        result: {
          found: targets.length,
          synced: updatedCount,
          updated: updatedCount,
          skipped: alreadyHave,
          summary,
          errors: errors.map((e) => `${e.book}: ${e.error}`),
        },
      });
    } catch (error: any) {
      sendEvent({ type: "error", error: error.message });
    }
  }
}
