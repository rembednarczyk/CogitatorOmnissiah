import pLimit from "p-limit";
import { NotionAdapter } from "../notion.adapter";
import { WikiAdapter } from "../wiki.adapter";
import { WikiParser } from "../wiki.parser";
import { NotionBook, SyncEvent } from "../src/types";
import { isWikiAuthorMatch } from "./dataNormalizer";

export class CyclesSyncService {
  constructor(private notion: NotionAdapter, private wiki: WikiAdapter) {}

  async runCyclesSync(sendEvent: (data: SyncEvent) => void, checkCancellation: () => boolean) {
    try {
      const databaseId = process.env.NOTION_DATABASE_ID;
      const actualDataSourceId = await this.notion.resolveDataSourceId(databaseId!);
      sendEvent({ type: "status", message: "Sprawdzanie struktury bazy Notion..." });
      await this.notion.createColumnIfNeeded("Część cyklu", "checkbox");
      sendEvent({ type: "status", message: "Pobieranie listy książek z Notion..." });
      const allBooks: NotionBook[] = await this.notion.queryAllBooks((count) => sendEvent({ type: "status", message: `Pobrano ${count} książek z Notion...` }), checkCancellation);
      
      if (checkCancellation()) { sendEvent({ type: "status", message: "Przerwano synchronizację cykli." }); return; }

      // Zbieranie unikalnych tytułów do pobrania (zarówno polskie jak i oryginalne)
      const titlesToFetch = Array.from(new Set([
        ...allBooks.map(b => b.plTitle).filter(Boolean),
        ...allBooks.map(b => b.origTitle).filter(Boolean)
      ])) as string[];
      
      sendEvent({ type: "status", message: `Pobieranie treści ${titlesToFetch.length} stron z Encyklopedii (Bulk API)...` });
      const { contents: wikiContents, failedTitles } = await this.wiki.fetchPagesContentBulk(titlesToFetch);

      let processedCount = 0, updatedCount = 0;
      const syncSummary = { added: [] as string[], updated: [] as string[] };
      const errors: any[] = [];
      if (failedTitles.length > 0) {
        errors.push({ book: `${failedTitles.length} stron`, error: `Nie udało się pobrać treści z encyklopedii (fallback przez wyszukiwarkę): ${failedTitles.slice(0, 5).join(", ")}${failedTitles.length > 5 ? "…" : ""}` });
      }
      const limit = pLimit(3);
      
      const isAuthorMatch = isWikiAuthorMatch;

      const checkCycleInWikitext = (wikitext: string): boolean => {
        if (!wikitext) return false;
        // Extended cycle detection: |cykl=, |cykle=, {{Cykl}}, {{cykl}}
        // Exclude |seria= to avoid false positives
        const hasCycleParam = /\|\s*cykl(e)?\s*=\s*[^\s|}]/i.test(wikitext);
        const hasCycleTemplate = /\{\{(C|c)ykl\s*\|/i.test(wikitext);
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

          // 1. Try Bulk Fetch results (Polish title first, then Original)
          wikitext = (plTitle ? wikiContents[plTitle.toLowerCase()] : null) ||
                     (origTitle ? wikiContents[origTitle.toLowerCase()] : null) || "";

          if (wikitext) {
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
              const wikiAuthor = WikiParser.extractAuthor(content);
              if (isAuthorMatch(wikiAuthor, notionAuthor)) {
                wikitext = content;
                foundSource = `Search (Orig): ${title}`;
                break;
              }
            }
          }

          // 4. Direct Fetch Fallback (Exact title from Notion)
          // Bez wewnętrznego catch — fetchPageContent zwraca "" dla brakującej
          // strony, ale RZUCA przy awarii infrastruktury (blokada IP/timeout).
          // Połykanie tego rzutu zamieniało "sieć padła" w "brak danych → pomiń",
          // przez co awaria widoczna tylko w tej ścieżce znikała po cichu. Teraz
          // propaguje do per-book catch niżej i trafia do errors[].
          if (!wikitext && plTitle) {
            const content = await this.wiki.fetchPageContent(plTitle);
            const wikiAuthor = WikiParser.extractAuthor(content);
            if (isAuthorMatch(wikiAuthor, notionAuthor)) {
              wikitext = content;
              foundSource = `Direct Fetch: ${plTitle}`;
            }
          }

          if (!wikitext) return;

          const hasCycle = checkCycleInWikitext(wikitext);
          if (hasCycle !== book.currentCzesccyklu) {
            await this.notion.updatePage(book.id, { "Część cyklu": { checkbox: hasCycle } });
            updatedCount++;
            syncSummary.updated.push(`${plTitle || origTitle} (Zaktualizowano: Część cyklu via ${foundSource})`);
          }
        } catch (err: any) { errors.push({ book: plTitle || origTitle, error: err.message }); }
      }));

      await Promise.all(syncTasks);

      sendEvent({ type: "complete", result: { success: !checkCancellation(), found: allBooks.length, updated: updatedCount, summary: syncSummary, errors: errors.length > 0 ? errors : undefined } });
    } catch (error: any) { sendEvent({ type: "error", error: error.message }); }
  }
}
