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
      const databaseId = process.env.NOTION_DATABASE_ID;
      const actualDataSourceId = await this.notion.resolveDataSourceId(databaseId!);
      sendEvent({ type: "status", message: "Sprawdzanie struktury bazy Notion..." });
      await this.notion.createColumnIfNeeded("Część cyklu", "checkbox");
      sendEvent({ type: "status", message: "Pobieranie listy książek z Notion..." });
      const rawBooks: NotionBook[] = await this.notion.queryAllBooks((count) => sendEvent({ type: "status", message: `Pobrano ${count} książek z Notion...` }), checkCancellation);
      // Wykrywanie przynależności do cyklu dotyczy pozycji NAGRODOWYCH — poboczne
      // tomy cykli (Kategoria="Tom cyklu") są z definicji częścią cyklu i mają
      // własny rytuał żniw, więc pomijamy je zamiast redundantnie taggować.
      const allBooks = rawBooks.filter(isAwardBook);

      if (checkCancellation()) { sendEvent({ type: "status", message: "Przerwano synchronizację cykli." }); return; }

      // Zbieranie unikalnych tytułów do pobrania (zarówno polskie jak i oryginalne)
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
        // Wykrywanie cyklu: NIEPUSTE pole |cykl= / |cykle= w infoboksie {{Książka}}
        // (potwierdzone na realnym rawie: „| cykl = Childe"). Świadomie WYKLUCZAMY
        // |seria= — na Encyklopedii to imprint wydawcy (np. „Kanon science fiction"),
        // nie cykl fabularny → inaczej byłyby false-positive.
        const hasCycleParam = /\|\s*cykl(e)?\s*=\s*[^\s|}]/i.test(wikitext);
        // Szablon nawigacyjny cyklu. Poszerzone vs stare `\{\{Cykl\s*\|` — łapie też
        // `{{Cykl}}` (bez parametrów) i `{{Cykl nawigacja|…}}`, a wciąż odrzuca np.
        // `{{Cyklista}}` (po „cykl" musi iść spacja / pipe / zamknięcie).
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
          // Czy w OGÓLE natrafiliśmy na treść strony (choćby odrzuconą przez bramkę
          // autora). Rozróżnia dwie przyczyny pominięcia: „strony nie ma" vs „strona
          // jest, ale autor się nie zgadza" — inaczej pominięcie było niewidoczne i
          // wyglądało jak „książka nie należy do cyklu".
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
          // Bez wewnętrznego catch — fetchPageContent zwraca "" dla brakującej
          // strony, ale RZUCA przy awarii infrastruktury (blokada IP/timeout).
          // Połykanie tego rzutu zamieniało "sieć padła" w "brak danych → pomiń",
          // przez co awaria widoczna tylko w tej ścieżce znikała po cichu. Teraz
          // propaguje do per-book catch niżej i trafia do errors[].
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
            // Honest reporting: książka pominięta, cykl NIE oceniony. Bez tego
            // „complete" raportował sam sukces i user nie wiedział, że część
            // pozycji w ogóle nie sprawdzono (root cause „czasem nie łapie cykli").
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
