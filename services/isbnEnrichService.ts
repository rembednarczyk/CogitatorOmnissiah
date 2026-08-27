import pLimit from "p-limit";
import { NotionAdapter } from "../notion.adapter";
import { NotionBook, SyncEvent } from "../src/types";
import { lookupIsbnsByTitle } from "./isbnLookupService";
import { isAwardBook } from "./bookCategory";
import { createLogger } from "../logger";

const log = createLogger("IsbnEnrich");

/**
 * Enrichment ritual for the barcode "variant B": fills the „ISBN" column on award
 * books by looking each up across three catalogs (Google Books, OpenLibrary,
 * Biblioteka Narodowa). Stored ISBNs let a mobile scan match a row DIRECTLY, without
 * any on-scan external call.
 *
 * We store the canonical ISBN-13s of ALL editions we can resolve (a delimited list),
 * because the use case is „do I own this title at all", not „this exact edition" — so
 * a barcode of any edition (hardback, paperback, reissue, Polish or original) still
 * identifies the row. Variant A (resolve → fuzzy search) is the fallback when nothing
 * is stored.
 *
 * EVERY award book is (re)processed and results are MERGED into the stored list — a
 * row that already had, say, only the original-language ISBN gains its Polish edition
 * ISBN on a re-run. A row is written only when the merge adds something new (no
 * needless writes). Books are looked up by BOTH their Polish and original titles,
 * because Biblioteka Narodowa indexes the Polish title („Diuna"), not the original
 * („Dune"). Cycle sibling volumes are excluded — barcode lookup is an award concern.
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

      // Every award book with a title — re-processed and merged (not gap-filled), so
      // already-populated rows still gain newly-found (e.g. Polish) edition ISBNs.
      const targets = rawBooks
        .filter(isAwardBook)
        .filter((b) => (b.plTitle && b.plTitle.trim()) || (b.origTitle && b.origTitle.trim()));

      // Make sure the column exists before any write (schema ritual may not have run).
      await this.notion.createColumnIfNeeded("ISBN", "rich_text");

      let processedCount = 0, updatedCount = 0, unchangedCount = 0;
      const summary = { updated: [] as string[], skipped: [] as string[] };
      const errors: { book: string; error: string }[] = [];

      const limit = pLimit(3);

      const tasks = targets.map((book) => limit(async () => {
        if (checkCancellation()) return;

        processedCount++;
        if (processedCount % 10 === 0 || processedCount === targets.length) {
          sendEvent({ type: "progress", message: "Nadawanie Sygnatur (ISBN) z katalogów...", current: processedCount, total: targets.length });
        }

        const label = book.plTitle || book.origTitle || book.id;
        // Query by BOTH titles: original (Google/OpenLibrary index it) and Polish
        // (Biblioteka Narodowa indexes it) — deduped, non-empty.
        const titles = Array.from(new Set([book.plTitle?.trim(), book.origTitle?.trim()].filter(Boolean))) as string[];
        if (titles.length === 0) return;

        const existing = new Set(book.isbns || []);
        const found = new Set<string>(existing);
        let lastError: string | null = null;
        let anySourceResponded = false;

        for (const title of titles) {
          try {
            (await lookupIsbnsByTitle(title, book.author)).forEach((x) => found.add(x));
            anySourceResponded = true;
          } catch (err: any) {
            lastError = err?.message || "nieznany błąd";
          }
        }

        // All lookups errored and we have nothing → a real outage for this book.
        if (!anySourceResponded && found.size === 0) {
          log.warn("Błąd wzbogacania ISBN", { book: label, error: lastError });
          errors.push({ book: label, error: lastError || "nieznany błąd" });
          return;
        }

        if (found.size === 0) {
          summary.skipped.push(label); // sources responded, but no ISBN anywhere
          return;
        }
        if (found.size === existing.size) {
          unchangedCount++; // already had everything the catalogs know
          return;
        }

        // The merge added at least one new ISBN → persist the full deduped list.
        const merged = Array.from(found);
        try {
          await this.notion.updatePage(book.id, { "ISBN": this.notion.buildPropertyValue(merged.join(", "), "rich_text") });
          updatedCount++;
          summary.updated.push(`${label} (ISBN: ${merged.join(", ")})`);
        } catch (err: any) {
          log.warn("Błąd zapisu ISBN", { book: label, error: err?.message });
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
          unchanged: unchangedCount,
          summary,
          errors: errors.map((e) => `${e.book}: ${e.error}`),
        },
      });
    } catch (error: any) {
      sendEvent({ type: "error", error: error.message });
    }
  }
}
