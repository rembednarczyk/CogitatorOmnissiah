import axios from "axios";
import { NotionAdapter } from "../notion.adapter";
import { SyncEvent } from "../src/types";
import { withRetry } from "../retry";
import { createLogger } from "../logger";
import { getRandomUserAgent, createScrapingAgent } from "../scrapingClient";
import { parseVintedItems } from "./vintedParser";

const log = createLogger("VintedScan");

const REQUEST_TIMEOUT = 15000;
const MAX_RETRIES = 2;
// Ile zablokowanych/błędnych pozycji ponawiamy w drugim przejściu (żeby nie
// wydłużać skanu w nieskończoność, gdy IP zostało twardo oflagowane).
const RETRY_PASS_LIMIT = 25;

const delay = (ms: number) => new Promise((r) => setTimeout(r, ms));

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
      // Pozycje, które padły blokadą bota / błędem — bloki Cloudflare bywają
      // przejściowe, więc próbujemy je jeszcze raz po głównym przejściu.
      const retryQueue: any[] = [];

      for (let i = 0; i < candidates.length; i++) {
        if (checkCancellation()) {
          sendEvent({ type: "status", message: "Skanowanie Vinted przerwane przez użytkownika." });
          break;
        }
        const book = candidates[i];
        sendEvent({
          type: "progress",
          message: `Sprawdzanie Vinted: ${book.plTitle} ${book.author || ""}`.trim() + ` (${i + 1}/${candidates.length})`,
          current: i + 1,
          total: candidates.length,
        });

        const status = await this.scanBook(book, httpsAgent, results, sendEvent);
        if (status === "blocked" || status === "error") retryQueue.push(book);

        // Odstęp z jitterem na każdej ścieżce — pomijanie go (np. przy braku
        // wyników) to prosta droga do blokady.
        await delay(3000 + Math.floor(Math.random() * 2000));
      }

      // Druga próba dla zablokowanych/błędnych — dłuższy cooldown, tylko raz,
      // z limitem, żeby przy twardo oflagowanym IP nie ciągnąć skanu bez końca.
      const toRetry = retryQueue.slice(0, RETRY_PASS_LIMIT);
      if (!checkCancellation() && toRetry.length > 0) {
        if (retryQueue.length > RETRY_PASS_LIMIT) {
          sendEvent({ type: "status", message: `Druga próba dla ${toRetry.length} z ${retryQueue.length} zablokowanych pozycji (limit)...` });
        } else {
          sendEvent({ type: "status", message: `Druga próba dla ${toRetry.length} zablokowanych pozycji...` });
        }
        for (let i = 0; i < toRetry.length; i++) {
          if (checkCancellation()) break;
          const book = toRetry[i];
          // Dłuższy, losowy cooldown przed ponowieniem zablokowanej pozycji.
          await delay(8000 + Math.floor(Math.random() * 4000));
          sendEvent({
            type: "progress",
            message: `Ponawiam (blokada): ${book.plTitle} (${i + 1}/${toRetry.length})`,
            current: candidates.length,
            total: candidates.length,
          });
          await this.scanBook(book, httpsAgent, results, sendEvent);
        }
      }

      const wasCancelled = checkCancellation();
      sendEvent({ type: "complete", result: { success: !wasCancelled, cancelled: wasCancelled, results, message: wasCancelled ? `Skanowanie Vinted przerwane. Znaleziono oferty dla ${results.length} książek przed przerwaniem.` : `Zakończono skanowanie Vinted. Znaleziono oferty dla ${results.length} książek.` } });
    } catch (error: any) {
      log.error("Błąd inicjalizacji Vinted", { message: error.message });
      sendEvent({ type: "error", error: `Błąd inicjalizacji Vinted: ${error.message}` });
    }
  }

  /**
   * Sprawdza pojedynczą książkę na Vinted i emituje zdarzenia (search_attempt,
   * ewentualny match). Dokłada trafienie do `results`. Zwraca status wyniku, by
   * wołający mógł dołożyć pozycję do kolejki ponowień (blocked/error).
   */
  private async scanBook(
    book: any,
    httpsAgent: any,
    results: any[],
    sendEvent: (data: SyncEvent) => void,
  ): Promise<"success" | "no_results" | "blocked" | "error"> {
    const title = book.plTitle;
    const searchText = `${title} ${book.author || ""}`.trim();
    const url = `https://www.vinted.pl/catalog?catalog[]=2319&language_book_ids[]=6440&page=1&order=price_low_to_high&price_from=2&currency=PLN&search_text=${encodeURIComponent(searchText)}`;
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

    const attempt = (status: "pending" | "success" | "no_results" | "blocked" | "error", itemCount = 0) =>
      sendEvent({ type: "search_attempt", result: { id: book.id, title, author: book.author, url, status, itemCount } });

    attempt("pending");

    try {
      const response = await withRetry(
        () => axios.get(url, { httpsAgent, headers, timeout: REQUEST_TIMEOUT }),
        MAX_RETRIES,
        4000,
      );

      const html = response.data;
      log.info(`Odpowiedź Vinted`, { title, chars: html.length });

      if (html.includes("cloudflare") || html.includes("captcha") || html.includes("robot")) {
        log.warn(`Vinted zablokował żądanie (wykrycie bota)`, { title });
        sendEvent({ type: "status", message: `⚠️ Vinted wykrył bota przy "${title}". Ponowię później...` });
        attempt("blocked");
        return "blocked";
      }

      if (html.includes("Brak wyników") || html.includes("Nie znaleźliśmy żadnych przedmiotów")) {
        log.info(`Brak wyników na Vinted`, { searchText });
        attempt("no_results");
        return "no_results";
      }

      const items = parseVintedItems(html, title, book.author || "");
      if (items.length > 0) {
        // Deduplikacja (druga próba może trafić już dodaną książkę).
        if (!results.some((r) => r.id === book.id)) {
          results.push({ id: book.id, title, author: book.author, searchUrl: url, vintedItems: items });
        }
        sendEvent({ type: "match", result: { id: book.id, title, author: book.author, searchUrl: url, vintedItems: items } });
        attempt("success", items.length);
        return "success";
      }

      attempt("no_results");
      return "no_results";
    } catch (err: any) {
      log.warn(`Błąd sprawdzania Vinted`, { title, error: err.message || "Nieznany błąd" });
      attempt("error");
      if (err.response?.status === 429) {
        sendEvent({ type: "status", message: `🛑 Vinted zablokował zapytania (429). Odczekaj chwilę...` });
        await delay(5000);
      } else if (err.response?.status === 403) {
        sendEvent({ type: "status", message: `🛡️ Vinted zablokował dostęp (403 - Cloudflare). Ponowię później...` });
      } else {
        sendEvent({ type: "status", message: `⚠️ Błąd Vinted dla "${title}": ${err.message || "Timeout"}. Kontynuuję...` });
      }
      return "error";
    }
  }
}
