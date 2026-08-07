import axios from "axios";
import { NotionAdapter } from "../notion.adapter";
import { SyncEvent } from "../src/types";
import { withRetry } from "../retry";
import { createLogger } from "../logger";
import { getRandomUserAgent, createScrapingAgent } from "../scrapingClient";
import { parseVintedItems } from "./vintedParser";

const log = createLogger("VintedScan");

/**
 * Skaner ofert na Vinted (bezpośredni scraper HTML — NIE AI). Dla każdej książki,
 * której jeszcze nie posiadamy, wyszukuje oferty w katalogu Vinted i emituje
 * trafienia przez SSE. Zob. docs/vinted-scanner.md.
 */
export class VintedSyncService {
  constructor(private notion: NotionAdapter) {}

  async runVintedCheck(
    sendEvent: (data: SyncEvent) => void,
    checkCancellation: () => boolean,
  ) {
    try {
      sendEvent({ type: "status", message: "Pobieranie listy książek z Notion..." });
      // cache: współdziel pobranie z sąsiadującymi skanami (biblioteka/Vinted).
      const allBooks = await this.notion.getBooksForStats(undefined, checkCancellation, { cache: true });

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
      const httpsAgent = createScrapingAgent();

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
          log.info(`Odpowiedź Vinted`, { title, chars: html.length });

          // Debug logging for empty results
          if (html.includes("cloudflare") || html.includes("captcha") || html.includes("robot")) {
            log.warn(`Vinted zablokował żądanie (wykrycie bota)`, { title });
            sendEvent({ type: "status", message: `⚠️ Vinted wykrył bota przy "${title}". Próbuję ominąć...` });
            sendEvent({
              type: "search_attempt",
              result: { id: book.id, title, author: book.author, url, status: "blocked", itemCount: 0 }
            });
          }

          if (html.includes("Brak wyników") || html.includes("Nie znaleźliśmy żadnych przedmiotów")) {
            // If "Title Author" failed, maybe try just "Title" in a real app,
            // but for now let's just log it.
            log.info(`Brak wyników na Vinted`, { searchText });
            sendEvent({
              type: "search_attempt",
              result: { id: book.id, title, author: book.author, url, status: "no_results", itemCount: 0 }
            });
            // Odczekaj jak przy każdym innym zapytaniu — pomijanie opóźnienia
            // przy braku wyników (częsty przypadek) to prosta droga do blokady
            await new Promise(resolve => setTimeout(resolve, 3000 + Math.floor(Math.random() * 2000)));
            continue;
          }

          const items = parseVintedItems(html, title, book.author || "");

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
          log.warn(`Błąd sprawdzania Vinted`, { title, error: err.message || "Nieznany błąd" });
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
      log.error("Błąd inicjalizacji Vinted", { message: error.message });
      sendEvent({ type: "error", error: `Błąd inicjalizacji Vinted: ${error.message}` });
    }
  }
}
