import express from "express";
import path from "path";
import { NotionAdapter } from "./notion.adapter";
import { WikiAdapter } from "./wiki.adapter";
import { WikiParser } from "./wiki.parser";
import { cleanTitle, calculateSimilarity, normalizeAuthor } from "./utils";
import dotenv from "dotenv";
import pLimit from "p-limit";
import axios from "axios";
import https from "https";
import { BookSyncService } from "./services/bookSyncService";
import { DuplicateSyncService } from "./services/duplicateSyncService";
import { PublisherSyncService } from "./services/publisherSyncService";
import { SeriesSyncService } from "./services/seriesSyncService";
import { CyclesSyncService } from "./services/cyclesSyncService";
import { LpSyncService } from "./services/lpSyncService";
import { StatsService } from "./services/statsService";
import { PurificationService } from "./services/purificationService";
import { SchemaValidationService } from "./services/schemaValidationService";
import { IntegrityService } from "./services/integrityService";
import { withRetry } from "./retry";
import syncRoutes from "./routes/syncRoutes";
import { createLogger, classifyHttpError } from "./logger";
import { SyncEvent } from "./src/types";

dotenv.config();

const serverLog = createLogger("Server");

const USER_AGENTS = [
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36',
  'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:122.0) Gecko/20100101 Firefox/122.0',
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10.15; rv:122.0) Gecko/20100101 Firefox/122.0',
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36 Edg/121.0.0.0',
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.2.1 Safari/605.1.15'
];

const getRandomUserAgent = () => USER_AGENTS[Math.floor(Math.random() * USER_AGENTS.length)];

const notionAdapter = new NotionAdapter(process.env.NOTION_API_KEY!, process.env.NOTION_DATABASE_ID!);
const wikiAdapter = new WikiAdapter();
const duplicateSyncService = new DuplicateSyncService(notionAdapter, wikiAdapter);
const bookSyncService = new BookSyncService(notionAdapter, wikiAdapter);
const publisherSyncService = new PublisherSyncService(notionAdapter, wikiAdapter);
const seriesSyncService = new SeriesSyncService(notionAdapter, wikiAdapter);
const cyclesSyncService = new CyclesSyncService(notionAdapter, wikiAdapter);
const lpSyncService = new LpSyncService(notionAdapter);
const statsService = new StatsService(notionAdapter);
const purificationService = new PurificationService(notionAdapter);
const schemaValidationService = new SchemaValidationService(notionAdapter);
const integrityService = new IntegrityService(notionAdapter, wikiAdapter);

interface SyncTask {
  name: string;
  cancelRequested: boolean;
}

class SyncManager {
  private currentTask: SyncTask | null = null;

  constructor(private notion: NotionAdapter, private wiki: WikiAdapter) {}

  get activeTask() {
    return this.currentTask?.name ?? null;
  }

  get isSyncing() {
    return this.currentTask !== null;
  }

  async getStats() {
    return await statsService.getStats();
  }

  async getNotionSchema() {
    return await this.notion.getSchema();
  }

  async updateNotionSchema(propertyName: string, propertyType: string, newOptions: any) {
    return await this.notion.updateSchema(propertyName, propertyType, newOptions);
  }

  private async executeTask(taskName: string, taskFn: (checkCancellation: () => boolean) => Promise<void>) {
    if (this.isSyncing) throw new Error(`Inna synchronizacja (${this.activeTask}) jest już w toku.`);
    const task: SyncTask = { name: taskName, cancelRequested: false };
    this.currentTask = task;
    try {
      await taskFn(() => task.cancelRequested);
    } finally {
      // Zwolnij blokadę tylko jeśli nadal należy do tego zadania —
      // po resetSyncState() mogło już wystartować nowe zadanie
      if (this.currentTask === task) {
        this.currentTask = null;
      }
    }
  }

  async runBookSync(params: { awardName?: string; pageTitle?: string; syncAll?: boolean }, sendEvent: (data: SyncEvent) => void) {
    await this.executeTask('book', (checkCancellation) => bookSyncService.runBookSync(params, sendEvent, checkCancellation));
  }

  async runPurifySync(sendEvent: (data: SyncEvent) => void) {
    await this.executeTask('purify', (checkCancellation) => purificationService.runPurification(sendEvent, checkCancellation));
  }

  async runSchemaSync(sendEvent: (data: SyncEvent) => void) {
    await this.executeTask('schema', (checkCancellation) => schemaValidationService.runSchemaValidation(sendEvent, checkCancellation));
  }

  async runPublisherSync(sendEvent: (data: SyncEvent) => void) {
    await this.executeTask('publisher', (checkCancellation) => publisherSyncService.runPublisherSync(sendEvent, checkCancellation));
  }

  async runSeriesSync(sendEvent: (data: SyncEvent) => void) {
    await this.executeTask('series', (checkCancellation) => seriesSyncService.runSeriesSync(sendEvent, checkCancellation));
  }

  async runDuplicateCheck(sendEvent: (data: SyncEvent) => void) {
    await this.executeTask('duplicates', (checkCancellation) => duplicateSyncService.runDuplicateCheck(sendEvent, checkCancellation));
  }

  async runLpSync(sendEvent: (data: SyncEvent) => void) {
    await this.executeTask('lp', (checkCancellation) => lpSyncService.runLpSync(sendEvent, checkCancellation));
  }

  async runCyclesSync(sendEvent: (data: SyncEvent) => void) {
    await this.executeTask('cycles', (checkCancellation) => cyclesSyncService.runCyclesSync(sendEvent, checkCancellation));
  }

  async runIntegrityCheck(sendEvent: (data: SyncEvent) => void) {
    await this.executeTask('integrity', (checkCancellation) => integrityService.runIntegrityCheck(sendEvent, checkCancellation));
  }

  async getWikiLastUpdate(pageTitle: string) {
    return await this.wiki.fetchLastRevisionDate(pageTitle);
  }

  async markAsRead(pageId: string) {
    return await this.notion.addTagToMultiSelect(pageId, "Źródło", "Przeczytane");
  }

  async checkLibraryAvailability(libraryCode: string, sendEvent: (data: SyncEvent) => void) {
    await this.executeTask('library', async (checkCancellation) => {
      sendEvent({ type: "status", message: "Pobieranie listy książek z Notion..." });
      const allBooks = await this.notion.getBooksForStats(undefined, checkCancellation);
      
      // Filter books that are NOT (Przeczytane, Biblioteka, Biblioteka 9, Posiadam)
      const candidates = allBooks.filter(b => {
        const zrodlo = b.zrodlo || [];
        const excluded = ["Przeczytane", "Biblioteka", "Biblioteka 9", "Posiadam"];
        return !zrodlo.some(z => excluded.includes(z)) && b.plTitle && b.plTitle.trim() !== "";
      });

      sendEvent({ type: "status", message: `Znaleziono ${candidates.length} kandydatów do sprawdzenia...` });
      
      const results: any[] = [];
      const httpsAgent = new https.Agent({ 
        keepAlive: true,
        keepAliveMsecs: 1000,
        timeout: 45000,
        maxSockets: 5
      });

      for (let i = 0; i < candidates.length; i++) {
        if (checkCancellation()) {
          sendEvent({ type: "status", message: "Skanowanie przerwane przez użytkownika." });
          break;
        }
        const book = candidates[i];
        const title = book.plTitle;
        const fullName = `${title} ${book.author || ""}`.trim();
        
        sendEvent({ 
          type: "progress", 
          message: `Sprawdzanie: ${fullName} (${i + 1}/${candidates.length})`,
          current: i + 1,
          total: candidates.length
        });

        const url = `https://opac.mbp.lublin.pl/search/description?q=${encodeURIComponent(title)}&index=1&scope=full&f2%5B0%5D=${encodeURIComponent(libraryCode)}`;
        
        const headers = {
          'User-Agent': getRandomUserAgent(),
          'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8',
          'Accept-Language': 'pl-PL,pl;q=0.9,en-US;q=0.8,en;q=0.7',
          'Cache-Control': 'no-cache',
          'Pragma': 'no-cache',
          'Connection': 'keep-alive'
        };
        
        try {
          const response = await withRetry(async () => {
            return await axios.get(url, {
              httpsAgent,
              headers,
              timeout: 30000
            });
          }, 4, 3000);

          const html = response.data;
          
          // Simple check for results: if it doesn't contain "Brak wyników" or "Nie znaleziono"
          // and contains something that looks like a record (e.g., "record-item" or "Szczegóły")
          const noResults = html.includes("Brak wyników") || html.includes("Nie znaleziono");
          const hasResults = !noResults && (html.includes("class=\"record\"") || html.includes("Szczegóły"));

          if (hasResults) {
            let extractedTitle = null;
            let extractedAuthor = null;

            const titleRegex = /<dt[^>]*>\s*Tytuł:\s*<\/dt>\s*<dd[^>]*>\s*<span[^>]*>(.*?)<\/span>/i;
            const match = html.match(titleRegex);
            if (match) {
              extractedTitle = match[1].replace(/<[^>]+>/g, '').trim();
            }

            const authorRegex = /<dt[^>]*>\s*Autor:\s*<\/dt>\s*<dd[^>]*>\s*<span[^>]*>(.*?)<\/span>/i;
            const authorMatch = html.match(authorRegex);
            if (authorMatch) {
              extractedAuthor = authorMatch[1].replace(/<[^>]+>/g, '').trim();
            }

            let isMatch = false;
            
            // Title match
            const normNotionTitle = cleanTitle(book.plTitle || "").toLowerCase();
            const normOpacTitle = cleanTitle(extractedTitle || "").toLowerCase();
            const titleSimilarity = calculateSimilarity(normNotionTitle, normOpacTitle);
            const titleMatch = titleSimilarity > 0.8 || normOpacTitle.includes(normNotionTitle) || normNotionTitle.includes(normOpacTitle) || !extractedTitle;

            // Author match
            const normNotionAuthor = normalizeAuthor(book.author || "");
            const normOpacAuthor = normalizeAuthor(extractedAuthor || "");
            
            let authorMatchBool = false;
            if (!normNotionAuthor) {
                authorMatchBool = true;
            } else if (normOpacAuthor) {
                const authorSimilarity = calculateSimilarity(normNotionAuthor, normOpacAuthor);
                authorMatchBool = authorSimilarity > 0.7 || normOpacAuthor.includes(normNotionAuthor) || normNotionAuthor.includes(normOpacAuthor);
            } else {
                const authorParts = normNotionAuthor.split(' ').filter((p: string) => p.length > 2);
                const allPartsFound = authorParts.length > 0 && authorParts.every((part: string) => html.toLowerCase().includes(part));
                authorMatchBool = allPartsFound;
            }

            if (titleMatch && authorMatchBool) {
              const matchResult = {
                id: book.id,
                title: book.plTitle,
                author: book.author,
                year: book.year,
                extractedTitle: extractedTitle,
                extractedAuthor: extractedAuthor
              };
              results.push(matchResult);
              sendEvent({ type: "match", result: matchResult });
            }
          }
        } catch (err: any) {
          console.warn(`Error checking ${title}: ${err.message || "Nieznany błąd"}`);
          // Don't throw, just continue with the next book
          // We can optionally send a status update about the error
          sendEvent({ 
            type: "status", 
            message: `⚠️ Błąd sprawdzania "${title}": ${err.message || "Timeout/Błąd sieci"}. Kontynuuję...` 
          });
        }

        // Add a small delay between requests
        await new Promise(resolve => setTimeout(resolve, 500));
      }

      const wasCancelled = checkCancellation();
      sendEvent({ type: "complete", result: { success: !wasCancelled, cancelled: wasCancelled, results, message: wasCancelled ? `Skanowanie przerwane. Znaleziono ${results.length} książek przed przerwaniem.` : `Zakończono sprawdzanie. Znaleziono ${results.length} książek.` } });
    });
  }

  async checkVintedAvailability(sendEvent: (data: SyncEvent) => void) {
    await this.executeTask('vinted', async (checkCancellation) => {
      try {
        sendEvent({ type: "status", message: "Pobieranie listy książek z Notion..." });
        const allBooks = await this.notion.getBooksForStats(undefined, checkCancellation);
        
        // Filter books:
        // - Have Polish title
        // - Exclude from source: Posiadam, Przeczytane, Audioteka, Biblioteka, Biblioteka 9
        const candidates = allBooks.filter(b => {
          const zrodlo = b.zrodlo || [];
          const excluded = ["Posiadam", "Przeczytane", "Audioteka", "Biblioteka", "Biblioteka 9"];
          return !zrodlo.some(z => excluded.includes(z)) && b.plTitle && b.plTitle.trim() !== "";
        });

        sendEvent({ type: "status", message: `Znaleziono ${candidates.length} kandydatów do sprawdzenia na Vinted...` });
        
        const results: any[] = [];
      const httpsAgent = new https.Agent({ 
        keepAlive: true,
        keepAliveMsecs: 1000,
        timeout: 45000,
        maxSockets: 5
      });

      for (let i = 0; i < candidates.length; i++) {
        if (checkCancellation()) {
          sendEvent({ type: "status", message: "Skanowanie Vinted przerwane przez użytkownika." });
          break;
        }
        const book = candidates[i];
        const title = book.plTitle;
        const searchText = `${title} ${book.author || ""}`.trim();
        
        const headers = {
          'User-Agent': getRandomUserAgent(),
          'Accept-Language': 'pl-PL,pl;q=0.9,en-US;q=0.8,en;q=0.7',
          'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8',
          'Referer': 'https://www.vinted.pl/',
          'Upgrade-Insecure-Requests': '1',
          'Sec-Fetch-Dest': 'document',
          'Sec-Fetch-Mode': 'navigate',
          'Sec-Fetch-Site': 'none',
          'Sec-Fetch-User': '?1',
          'Accept-Encoding': 'gzip, deflate, br',
          'Connection': 'keep-alive',
          'Cache-Control': 'max-age=0',
        };

        sendEvent({ 
          type: "progress", 
          message: `Sprawdzanie Vinted: ${searchText} (${i + 1}/${candidates.length})`,
          current: i + 1,
          total: candidates.length
        });

        // Vinted Search URL
        const url = `https://www.vinted.pl/catalog?catalog[]=2319&language_book_ids[]=6440&page=1&order=price_low_to_high&price_from=2&currency=PLN&search_text=${encodeURIComponent(searchText)}`;
        
        // Initial search attempt event
        sendEvent({
          type: "search_attempt",
          result: {
            id: book.id,
            title: book.plTitle,
            author: book.author,
            url,
            status: "pending",
            itemCount: 0
          }
        });

        try {
          const response = await withRetry(async () => {
            return await axios.get(url, {
              httpsAgent,
              headers,
              timeout: 30000
            });
          }, 3, 4000);

          const html = response.data;
          console.log(`Vinted response for ${title}: ${html.length} chars`);
          
          // Debug logging for empty results
          if (html.includes("cloudflare") || html.includes("captcha") || html.includes("robot")) {
            console.warn(`Vinted blocked request for ${title} (Bot detection detected)`);
            sendEvent({ type: "status", message: `⚠️ Vinted wykrył bota przy "${title}". Próbuję ominąć...` });
            sendEvent({
              type: "search_attempt",
              result: { id: book.id, title, author: book.author, url, status: "blocked", itemCount: 0 }
            });
          }

          if (html.includes("Brak wyników") || html.includes("Nie znaleźliśmy żadnych przedmiotów")) {
            // If "Title Author" failed, maybe try just "Title" in a real app, 
            // but for now let's just log it.
            console.log(`No results found on Vinted for: ${searchText}`);
            sendEvent({
              type: "search_attempt",
              result: { id: book.id, title, author: book.author, url, status: "no_results", itemCount: 0 }
            });
            // Odczekaj jak przy każdym innym zapytaniu — pomijanie opóźnienia
            // przy braku wyników (częsty przypadek) to prosta droga do blokady
            await new Promise(resolve => setTimeout(resolve, 3000 + Math.floor(Math.random() * 2000)));
            continue;
          }
          
          const items: any[] = [];
          
          // Vinted often stores data in a script tag with data-component-name="Catalog"
          // or similar. We'll try to find the JSON blob more reliably.
          let rawItems: any[] = [];
          
          // Try to find JSON in script tag content or data-props attribute
          const catalogMatch = html.match(/data-component-name="Catalog"[^>]*data-props="([^"]+)"/s) || 
                               html.match(/data-component-name="Catalog"[^>]*>\s*({.*?})\s*<\/script>/s);
          
          if (catalogMatch) {
            try {
              // HTML attributes use &quot; instead of "
              let jsonStr = catalogMatch[1];
              if (jsonStr.includes('&quot;')) {
                jsonStr = jsonStr.replace(/&quot;/g, '"')
                                 .replace(/&amp;/g, '&')
                                 .replace(/&lt;/g, '<')
                                 .replace(/&gt;/g, '>')
                                 .replace(/&#39;/g, "'");
              }
              const catalogData = JSON.parse(jsonStr);
              rawItems = catalogData.items?.list || 
                         catalogData.items || 
                         catalogData.catalog?.results?.items || 
                         catalogData.catalog?.items ||
                         [];
              console.log(`Found ${rawItems.length} raw items in JSON for ${title}`);
            } catch (e) {
              console.warn("Failed to parse Vinted Catalog JSON");
            }
          }

          // Fallback to the old "items" regex if the above failed
          if (rawItems.length === 0) {
            const jsonMatch = html.match(/"items":\s*(\[.*?\])/);
            if (jsonMatch) {
              try {
                // Try to find the matching closing bracket for the array
                let bracketCount = 0;
                let endIndex = -1;
                const str = jsonMatch[1];
                for (let i = 0; i < str.length; i++) {
                  if (str[i] === '[') bracketCount++;
                  else if (str[i] === ']') {
                    bracketCount--;
                    if (bracketCount === 0) {
                      endIndex = i + 1;
                      break;
                    }
                  }
                }
                const jsonStr = endIndex !== -1 ? str.substring(0, endIndex) : str;
                rawItems = JSON.parse(jsonStr);
              } catch (e) {
                // If it fails, it might be because the regex was too simple
              }
            }
          }

          if (Array.isArray(rawItems)) {
            for (const item of rawItems) {
              if (items.length >= 5) break;
              
              const itemTitle = (item.title || "").toLowerCase();
              const searchTitle = title.toLowerCase();
              const searchAuthor = (book.author || "").toLowerCase();
              
              // More flexible relevance check:
              // 1. Item title contains the book title
              // 2. OR Book title contains the item title
              // 3. OR Item title contains the author's name
              const hasTitle = itemTitle.includes(searchTitle) || searchTitle.includes(itemTitle);
              const hasAuthor = searchAuthor && itemTitle.includes(searchAuthor);
              
              if (hasTitle || hasAuthor) {
                items.push({
                  id: item.id,
                  title: item.title || itemTitle,
                  price: item.price?.amount || item.total_item_price?.amount || item.price?.amount_decimal || item.price || "??",
                  currency: item.price?.currency_code || item.currency || "PLN",
                  url: item.url ? (item.url.startsWith('http') ? item.url : `https://www.vinted.pl${item.url}`) : `https://www.vinted.pl/items/${item.id}`
                });
              }
            }
          }

          // Fallback to regex if JSON parsing failed or found no items
          if (items.length === 0) {
            // Look for item blocks
            const itemBlocks = html.split('class="feed-grid__item"');
            if (itemBlocks.length > 1) {
              for (let j = 1; j < itemBlocks.length && items.length < 5; j++) {
                const block = itemBlocks[j];
                const urlMatch = block.match(/href="(\/items\/[^"]+)"/);
                const titleMatch = block.match(/title="([^"]+)"/);
                const priceMatch = block.match(/aria-label="([^"]*?(\d+[.,]\d+)\s*([A-Z]{3}|zł))"/i) || 
                                   block.match(/>(\d+[.,]\d+)\s*([A-Z]{3}|zł)</i);

                if (urlMatch && titleMatch) {
                  const itemTitle = titleMatch[1];
                  if (itemTitle.toLowerCase().includes(title.toLowerCase())) {
                    items.push({
                      title: itemTitle,
                      url: `https://www.vinted.pl${urlMatch[1]}`,
                      price: priceMatch ? priceMatch[1] : "Sprawdź",
                      currency: priceMatch ? (priceMatch[3] || priceMatch[2]) : "PLN"
                    });
                  }
                }
              }
            }
          }

          // Last resort: simple global regex
          if (items.length === 0) {
            const itemRegex = /href="(\/items\/[^"]+)"[^>]*title="([^"]+)"/g;
            let match;
            while ((match = itemRegex.exec(html)) !== null && items.length < 5) {
              const itemUrl = `https://www.vinted.pl${match[1]}`;
              const itemTitle = match[2];
              
              if (itemTitle.toLowerCase().includes(title.toLowerCase())) {
                items.push({
                  title: itemTitle,
                  url: itemUrl,
                  price: "Sprawdź",
                  currency: "PLN"
                });
              }
            }
          }

          if (items.length > 0) {
            const matchResult = {
              id: book.id,
              title: book.plTitle,
              author: book.author,
              searchUrl: url,
              vintedItems: items
            };
            results.push(matchResult);
            sendEvent({ type: "match", result: matchResult });
            sendEvent({
              type: "search_attempt",
              result: { id: book.id, title, author: book.author, url, status: "success", itemCount: items.length }
            });
          } else {
            sendEvent({
              type: "search_attempt",
              result: { id: book.id, title, author: book.author, url, status: "no_results", itemCount: 0 }
            });
          }
        } catch (err: any) {
          console.warn(`Error checking Vinted for ${title}: ${err.message || "Nieznany błąd"}`);
          sendEvent({
            type: "search_attempt",
            result: { id: book.id, title, author: book.author, url, status: "error", itemCount: 0 }
          });
          if (err.response?.status === 429) {
            sendEvent({ 
              type: "status", 
              message: `🛑 Vinted zablokował zapytania (429). Odczekaj chwilę...` 
            });
            // Wait longer if blocked
            await new Promise(resolve => setTimeout(resolve, 5000));
          } else if (err.response?.status === 403) {
            sendEvent({ 
              type: "status", 
              message: `🛡️ Vinted zablokował dostęp (403 - Cloudflare). Próbuję dalej...` 
            });
          } else {
            sendEvent({ 
              type: "status", 
              message: `⚠️ Błąd Vinted dla "${title}": ${err.message || "Timeout"}. Kontynuuję...` 
            });
          }
        }

        // Delay to avoid being blocked (with jitter)
        const jitter = Math.floor(Math.random() * 2000);
        await new Promise(resolve => setTimeout(resolve, 3000 + jitter));
      }

      const wasCancelled = checkCancellation();
      sendEvent({ type: "complete", result: { success: !wasCancelled, cancelled: wasCancelled, results, message: wasCancelled ? `Skanowanie Vinted przerwane. Znaleziono oferty dla ${results.length} książek przed przerwaniem.` : `Zakończono skanowanie Vinted. Znaleziono oferty dla ${results.length} książek.` } });
      } catch (error: any) {
        console.error("Vinted Initialization Error:", error);
        sendEvent({ type: "error", error: `Błąd inicjalizacji Vinted: ${error.message}` });
      }
    });
  }

  /**
   * Diagnostyka end-to-end: sprawdza połączenie z Notion oraz pobranie i
   * parsowanie każdej strony nagrody z encyklopedii. Zwraca strukturę JSON,
   * którą można otworzyć w przeglądarce (GET /api/diagnostics) — jedno miejsce,
   * by zobaczyć, DLACZEGO sync nie działa (blokada IP, brak strony, 0 książek).
   */
  async runDiagnostics() {
    const startedAt = Date.now();
    const report: any = {
      env: {
        hasNotionKey: !!process.env.NOTION_API_KEY,
        hasDatabaseId: !!process.env.NOTION_DATABASE_ID,
        nodeEnv: process.env.NODE_ENV || "(unset)",
      },
      notion: { ok: false } as any,
      wiki: [] as any[],
      summary: "",
    };

    // 1. Notion — inicjalizacja i lekki odczyt schematu
    try {
      await this.notion.init();
      const schema = await this.notion.getSchema();
      report.notion = { ok: true, propertyCount: schema ? Object.keys(schema).length : 0 };
      serverLog.info("Diagnostics: Notion OK", report.notion);
    } catch (err: any) {
      report.notion = { ok: false, error: err?.message, code: err?.code };
      serverLog.error("Diagnostics: Notion FAILED", report.notion);
    }

    // 2. Wiki — pobranie każdej strony nagrody z osobna
    const AWARDS = [
      { name: "Nagroda Hugo", title: "Hugo nagroda powieść" },
      { name: "Nagroda Nebula", title: "Nebula nagroda najlepsza powieść" },
      { name: "Nagroda Locus", title: "Locus nagroda powieść" },
    ];
    for (const aw of AWARDS) {
      const t0 = Date.now();
      try {
        const books = await bookSyncService.fetchBooksFromMediaWiki(aw.title, aw.name, () => {});
        const entry = {
          award: aw.name, pageTitle: aw.title, ok: true,
          booksParsed: books.length, ms: Date.now() - t0,
          note: books.length === 0 ? "Pobrano stronę, ale sparsowano 0 książek — sprawdź tytuł strony lub układ tabeli." : undefined,
        };
        report.wiki.push(entry);
        serverLog.info("Diagnostics: wiki page OK", entry);
      } catch (err: any) {
        const info = classifyHttpError(err);
        const entry = {
          award: aw.name, pageTitle: aw.title, ok: false,
          classification: err?.classification || info.class,
          status: err?.status || info.status,
          hint: err?.userHint || info.hint,
          error: err?.message, ms: Date.now() - t0,
        };
        report.wiki.push(entry);
        serverLog.error("Diagnostics: wiki page FAILED", entry);
      }
    }

    // 3. Podsumowanie diagnozy
    const wikiOk = report.wiki.filter((w: any) => w.ok);
    const wikiBlocked = report.wiki.filter((w: any) => w.classification === "ip_blocked");
    if (!report.notion.ok) {
      report.summary = "Notion nie odpowiada — sprawdź NOTION_API_KEY / NOTION_DATABASE_ID i dostęp integracji.";
    } else if (wikiBlocked.length > 0) {
      report.summary = "Encyklopedia blokuje żądania serwera (403/Cloudflare). To najczęstsza przyczyna niedziałających synchronizacji na hostingu — IP serwera jest zablokowane. Uruchom lokalnie lub użyj proxy o zaufanym IP.";
    } else if (wikiOk.length > 0 && wikiOk.every((w: any) => w.booksParsed === 0)) {
      report.summary = "Strony pobrane, ale sparsowano 0 książek — prawdopodobnie zmienił się tytuł strony w encyklopedii albo układ tabeli.";
    } else if (wikiOk.length === report.wiki.length) {
      report.summary = "Wszystko działa: Notion i encyklopedia odpowiadają, książki są parsowane. Jeśli sync nadal nie działa, sprawdź logi konkretnego rytuału.";
    } else {
      report.summary = "Częściowa awaria pobierania z encyklopedii — szczegóły w polu 'wiki'.";
    }
    report.ms = Date.now() - startedAt;
    return report;
  }

  stopActiveSync() {
    if (this.currentTask) {
      this.currentTask.cancelRequested = true;
      return true;
    }
    return false;
  }

  resetSyncState() {
    // Nie zostawiaj osieroconego zadania piszącego do Notion — najpierw anuluj,
    // potem zwolnij blokadę. Zadanie zachowuje własny obiekt stanu, więc jego
    // finally nie wyczyści stanu nowego zadania (porównanie tożsamości w executeTask).
    if (this.currentTask) {
      this.currentTask.cancelRequested = true;
      this.currentTask = null;
    }
  }
}

export const syncManager = new SyncManager(notionAdapter, wikiAdapter);

export const app = express();
app.use(express.json());
app.use("/api", syncRoutes);

const PORT = parseInt(process.env.PORT || "3000", 10);
let server: any;

export async function startServer() {
  // Vite middleware for development
  if (process.env.NODE_ENV !== "production" && !process.env.VITEST) {
    // Dynamic import keeps vite out of the production bundle
    const { createServer: createViteServer } = await import("vite");
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else if (process.env.NODE_ENV === "production") {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  server = app.listen(PORT, "0.0.0.0", () => {
    serverLog.info(`Server running on port ${PORT}`, {
      port: PORT,
      nodeEnv: process.env.NODE_ENV || "(unset)",
      hasNotionKey: !!process.env.NOTION_API_KEY,
      hasDatabaseId: !!process.env.NOTION_DATABASE_ID,
      diagnostics: "GET /api/diagnostics",
    });
    if (!process.env.NOTION_API_KEY || !process.env.NOTION_DATABASE_ID) {
      serverLog.warn("Brak NOTION_API_KEY lub NOTION_DATABASE_ID — synchronizacje z Notion nie zadziałają.");
    }
  });
}

process.on('unhandledRejection', (reason, promise) => {
  serverLog.error('Unhandled Rejection', { reason: (reason as any)?.message || String(reason) });
});

process.on('uncaughtException', (err) => {
  serverLog.error('Uncaught Exception', { message: err?.message, stack: err?.stack?.split("\n").slice(0, 4).join(" | ") });
});

if (process.env.NODE_ENV !== 'test' && !process.env.VITEST) {
  startServer();
}

export const closeServer = () => {
  if (server) {
    server.close();
  }
};
