import pLimit from "p-limit";
import { NotionAdapter } from "../notion.adapter";
import { WikiAdapter } from "../wiki.adapter";
import { WikiParser } from "../wiki.parser";
import { NotionBook, SyncEvent } from "../src/types";
import { isWikiAuthorMatch } from "./dataNormalizer";
import { ConfigService } from "./configService";
import { isAwardBook } from "./bookCategory";

export class CyclesSyncService {
  constructor(private notion: NotionAdapter, private wiki: WikiAdapter, private config: ConfigService) {}

  async runCyclesSync(sendEvent: (data: SyncEvent) => void, checkCancellation: () => boolean) {
    try {
      sendEvent({ type: "status", message: "Sprawdzanie struktury bazy Notion..." });
      await this.notion.createColumnIfNeeded("Część cyklu", "checkbox");
      sendEvent({ type: "status", message: "Pobieranie listy książek z Notion..." });
      const rawBooks: NotionBook[] = await this.notion.queryAllBooks((count) => sendEvent({ type: "status", message: `Pobrano ${count} książek z Notion...` }), checkCancellation);
      // Cycle-membership detection concerns AWARD entries — side
      // cycle volumes (Kategoria="Tom cyklu") are by definition part of a cycle and have
      // their own harvest ritual, so we skip them instead of redundantly tagging.
      const allBooks = rawBooks.filter(isAwardBook);

      if (checkCancellation()) { sendEvent({ type: "status", message: "Przerwano synchronizację cykli." }); return; }

      // Collect unique titles to fetch (both Polish and original)
      const titlesToFetch = Array.from(new Set([
        ...allBooks.map(b => b.plTitle).filter(Boolean),
        ...allBooks.map(b => b.origTitle).filter(Boolean)
      ])) as string[];
      
      sendEvent({ type: "status", message: `Pobieranie treści ${titlesToFetch.length} stron z Encyklopedii (Bulk API)...` });
      const { contents: wikiContents, failedTitles } = await this.wiki.fetchPagesContentBulk(titlesToFetch);

      let processedCount = 0, updatedCount = 0, cyclesDetected = 0;
      const syncSummary = { added: [] as string[], updated: [] as string[], skipped: [] as string[] };
      const errors: any[] = [];
      if (failedTitles.length > 0) {
        errors.push({ book: `${failedTitles.length} stron`, error: `Nie udało się pobrać treści z encyklopedii (fallback przez wyszukiwarkę): ${failedTitles.slice(0, 5).join(", ")}${failedTitles.length > 5 ? "…" : ""}` });
      }
      const limit = pLimit((await this.config.getConfig()).sync.writeConcurrency);
      
      const isAuthorMatch = isWikiAuthorMatch;

      const checkCycleInWikitext = (wikitext: string): boolean => {
        if (!wikitext) return false;
        // Cycle detection: NON-EMPTY |cykl= / |cykle= field in the {{Książka}} infobox
        // (confirmed on real raw: „| cykl = Childe"). We deliberately EXCLUDE
        // |seria= — on the Encyclopedia it's a publisher imprint (e.g. „Kanon science fiction"),
        // not a story cycle → otherwise it would be a false positive.
        const hasCycleParam = /\|\s*cykl(e)?\s*=\s*[^\s|}]/i.test(wikitext);
        // Cycle navigation template. Widened vs the old `\{\{Cykl\s*\|` — also catches
        // `{{Cykl}}` (no parameters) and `{{Cykl nawigacja|…}}`, while still rejecting e.g.
        // `{{Cyklista}}` (after „cykl" there must be a space / pipe / closing).
        const hasCycleTemplate = /\{\{\s*cykl[\s|}]/i.test(wikitext);
        return hasCycleParam || hasCycleTemplate;
      };

      const syncTasks = allBooks.map((book) => limit(async () => {
        if (checkCancellation()) return;
        
        processedCount++;
        if (processedCount % 10 === 0 || processedCount === allBooks.length) {
          sendEvent({ type: "progress", message: "Analiza i aktualizacja cykli (In-Memory Diff)...", current: processedCount, total: allBooks.length });
        }
        
        const plTitle = book.plTitle;
        const origTitle = book.origTitle;
        const notionAuthor = book.author || "";
        
        if (!plTitle && !origTitle) return;
        
        try {
          let wikitext = "";
          let foundSource = "";
          // Whether we hit page content AT ALL (even if rejected by the author
          // gate). Distinguishes two skip causes: „page missing" vs „page
          // exists, but author doesn't match" — otherwise the skip was invisible and
          // looked like „book doesn't belong to a cycle".
          let sawPage = false;

          // 1. Try Bulk Fetch results (Polish title first, then Original)
          wikitext = (plTitle ? wikiContents[plTitle.toLowerCase()] : null) ||
                     (origTitle ? wikiContents[origTitle.toLowerCase()] : null) || "";

          if (wikitext) {
            sawPage = true;
            const wikiAuthor = WikiParser.extractAuthor(wikitext);
            if (!isAuthorMatch(wikiAuthor, notionAuthor)) {
              wikitext = "";
            } else {
              foundSource = "Bulk Fetch";
            }
          }

          // 2. Multi-Search (Polish title + Author)
          if (!wikitext && plTitle && notionAuthor) {
            const searchedTitles = await this.wiki.searchPage(`${plTitle} ${notionAuthor}`, 3);
            for (const title of searchedTitles) {
              const content = await this.wiki.fetchPageContent(title);
              if (content) sawPage = true;
              const wikiAuthor = WikiParser.extractAuthor(content);
              if (isAuthorMatch(wikiAuthor, notionAuthor)) {
                wikitext = content;
                foundSource = `Search (PL): ${title}`;
                break;
              }
            }
          }

          // 3. Multi-Search (Original title + Author)
          if (!wikitext && origTitle && notionAuthor) {
            const searchedTitles = await this.wiki.searchPage(`${origTitle} ${notionAuthor}`, 3);
            for (const title of searchedTitles) {
              const content = await this.wiki.fetchPageContent(title);
              if (content) sawPage = true;
              const wikiAuthor = WikiParser.extractAuthor(content);
              if (isAuthorMatch(wikiAuthor, notionAuthor)) {
                wikitext = content;
                foundSource = `Search (Orig): ${title}`;
                break;
              }
            }
          }

          // 4. Direct Fetch Fallback (Exact title from Notion)
          // No inner catch — fetchPageContent returns "" for a missing
          // page, but THROWS on infrastructure failure (IP block/timeout).
          // Swallowing that throw turned "network down" into "no data → skip",
          // so a failure visible only on this path vanished silently. Now it
          // propagates to the per-book catch below and lands in errors[].
          if (!wikitext && plTitle) {
            const content = await this.wiki.fetchPageContent(plTitle);
            if (content) sawPage = true;
            const wikiAuthor = WikiParser.extractAuthor(content);
            if (isAuthorMatch(wikiAuthor, notionAuthor)) {
              wikitext = content;
              foundSource = `Direct Fetch: ${plTitle}`;
            }
          }

          if (!wikitext) {
            // Honest reporting: book skipped, cycle NOT evaluated. Without this
            // „complete" reported only success and the user didn't know that some
            // entries weren't checked at all (root cause of "sometimes misses cycles").
            syncSummary.skipped.push(
              `${plTitle || origTitle}${sawPage ? " (autor się nie zgadza — strona pominięta)" : " (nie znaleziono strony w encyklopedii)"}`
            );
            return;
          }

          const hasCycle = checkCycleInWikitext(wikitext);
          if (hasCycle) cyclesDetected++;
          if (hasCycle !== book.currentCzesccyklu) {
            await this.notion.updatePage(book.id, { "Część cyklu": { checkbox: hasCycle } });
            updatedCount++;
            syncSummary.updated.push(`${plTitle || origTitle} (Zaktualizowano: Część cyklu via ${foundSource})`);
          }
        } catch (err: any) { errors.push({ book: plTitle || origTitle, error: err.message }); }
      }));

      await Promise.all(syncTasks);

      sendEvent({ type: "complete", result: { success: !checkCancellation(), found: allBooks.length, updated: updatedCount, cyclesDetected, skipped: syncSummary.skipped.length, summary: syncSummary, errors: errors.length > 0 ? errors : undefined } });
    } catch (error: any) { sendEvent({ type: "error", error: error.message }); }
  }
}
