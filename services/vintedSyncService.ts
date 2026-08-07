import axios from "axios";
import { NotionAdapter } from "../notion.adapter";
import { SyncEvent } from "../src/types";
import { withRetry } from "../retry";
import { createLogger } from "../logger";
import { getRandomUserAgent, createScrapingAgent } from "../scrapingClient";
import { parseVintedItems, vintedDiagnostics, looksBlocked, extractVintedSeller, VintedItem } from "./vintedParser";
import { NotionBook } from "../src/types";
import { offerFromItem, parseVintedData, mergeOffers, serializeVintedData, StoredVintedData, StoredOffer, StoredBookView } from "./vintedStore";

const log = createLogger("VintedScan");

/** Nagłówki żądania Vinted (świeży User-Agent na wywołanie). Wspólne dla skanu i grupowania. */
function vintedRequestHeaders() {
  return {
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
}

/**
 * Odczyt pamięci procesu (MB). Strony Vinted to ~7 MB HTML każda — na hostingu z
 * limitem RAM (Render free = 512 MB) powtarzane piki przy parsowaniu mogą wywołać
 * OOM-kill procesu, co urywa SSE i „ubija" skan przy w miarę stałej liczbie prób.
 * Dołączamy `rssMb`/`heapMb` do debug każdej próby, żeby to zobaczyć w panelu logów.
 */
function memMb() {
  const m = process.memoryUsage();
  return { rssMb: Math.round(m.rss / 1048576), heapMb: Math.round(m.heapUsed / 1048576) };
}

/**
 * Skaner ofert na Vinted (bezpośredni scraper HTML — NIE AI). Dla każdej książki,
 * której jeszcze nie posiadamy, wyszukuje oferty w katalogu Vinted i emituje
 * trafienia przez SSE. Zob. docs/vinted-scanner.md.
 */
export class VintedSyncService {
  constructor(private notion: NotionAdapter) {}

  /**
   * Etap 3: czyta składowane wyniki Vinted ze wszystkich książek (blob VintedData) do
   * renderu kafelków/paczek z bazy — bez re-scrape. Zwraca tylko książki z ofertami.
   */
  async getStoredData(): Promise<{ books: StoredBookView[]; generatedAt: string }> {
    const allBooks = await this.notion.getBooksForStats(undefined, undefined, { cache: true });
    const books: StoredBookView[] = [];
    for (const b of allBooks) {
      const data = parseVintedData(b.vintedData);
      if (!data || data.offers.length === 0) continue;
      books.push({ id: b.id, title: b.plTitle, author: b.author || "", scannedAt: data.scannedAt, offers: data.offers });
    }
    return { books, generatedAt: new Date().toISOString() };
  }

  /**
   * Zapisuje świeżo zeskanowane oferty książki do Notion (blob VintedData), scalając ze
   * składowanymi — zachowuje rozpoznanego sprzedawcę dla ofert, których URL nadal istnieje.
   * Best-effort: błąd zapisu nie przerywa skanu (dane w bazie to bonus, nie warunek).
   */
  private async persistBookOffers(book: NotionBook, items: VintedItem[], scannedAt: string): Promise<void> {
    try {
      const fresh = items.map(offerFromItem);
      const prev = parseVintedData(book.vintedData)?.offers;
      const merged = mergeOffers(fresh, prev);
      await this.notion.saveVintedData(book.id, serializeVintedData({ scannedAt, offers: merged }));
    } catch (e: any) {
      log.warn("Nie udało się zapisać VintedData", { title: book.plTitle, error: e?.message });
    }
  }

  async runVintedCheck(
    sendEvent: (data: SyncEvent) => void,
    checkCancellation: () => boolean,
    params?: { skipScannedWithinDays?: number },
  ) {
    try {
      sendEvent({ type: "status", message: "Pobieranie listy książek z Notion..." });
      // cache: współdziel pobranie z sąsiadującymi skanami (biblioteka/Vinted).
      const allBooks = await this.notion.getBooksForStats(undefined, checkCancellation, { cache: true });

      // Filter books:
      // - Have Polish title
      // - Exclude from source: Posiadam, Przeczytane, Audioteka, Biblioteka, Biblioteka 9
      let candidates = allBooks.filter(b => {
        const zrodlo = b.zrodlo || [];
        const excluded = ["Posiadam", "Przeczytane", "Audioteka", "Biblioteka", "Biblioteka 9"];
        return !zrodlo.some(z => excluded.includes(z)) && b.plTitle && b.plTitle.trim() !== "";
      });

      // Wznawianie: pomiń książki skanowane w ostatnich N dniach — skan rusza od tych
      // jeszcze niezrobionych (albo starszych niż okno). Dzięki temu przerwany przebieg
      // (limit ~160/kontener, drop na mobile) kontynuuje się zamiast zaczynać od zera.
      const skipDays = params?.skipScannedWithinDays;
      if (skipDays && skipDays > 0) {
        const cutoff = Date.now() - skipDays * 86_400_000;
        const before = candidates.length;
        candidates = candidates.filter(b => {
          const at = parseVintedData(b.vintedData)?.scannedAt;
          const t = at ? Date.parse(at) : NaN;
          return isNaN(t) || t < cutoff; // nigdy nieskanowana lub stara → skanuj
        });
        const skipped = before - candidates.length;
        if (skipped > 0) {
          sendEvent({ type: "status", message: `Wznawianie: pominięto ${skipped} świeżo skanowanych (< ${skipDays} dni). Do sprawdzenia: ${candidates.length}.` });
        }
      }

      sendEvent({ type: "status", message: `Znaleziono ${candidates.length} kandydatów do sprawdzenia na Vinted...` });

      const results: any[] = [];
      const httpsAgent = createScrapingAgent();

      // Zapewnij pole składowania raz na skan; gdy się nie uda — persystencja off (skan i tak leci).
      let persistEnabled = true;
      try {
        await this.notion.createColumnIfNeeded("VintedData");
      } catch (e: any) {
        persistEnabled = false;
        log.warn("Nie udało się zapewnić pola VintedData — persystencja wyłączona", { error: e?.message });
      }

      for (let i = 0; i < candidates.length; i++) {
        if (checkCancellation()) {
          sendEvent({ type: "status", message: "Skanowanie Vinted przerwane przez użytkownika." });
          break;
        }
        const book = candidates[i];
        const title = book.plTitle;
        const searchText = `${title} ${book.author || ""}`.trim();
        const scannedAt = new Date().toISOString();

        const headers = vintedRequestHeaders();

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
          log.info(`Odpowiedź Vinted`, { title, chars: html.length, ...memMb() });

          // Blokada = MAŁA strona challenge, nie samo słowo w wielkim HTML.
          if (looksBlocked(html)) {
            log.warn(`Vinted zablokował żądanie (wykrycie bota)`, { title });
            sendEvent({ type: "status", message: `⚠️ Vinted wykrył bota przy "${title}". Próbuję ominąć...` });
            sendEvent({
              type: "search_attempt",
              result: { id: book.id, title, author: book.author, url, status: "blocked", itemCount: 0, debug: { ...vintedDiagnostics(html, 0), ...memMb() } }
            });
          }

          if (html.includes("Brak wyników") || html.includes("Nie znaleźliśmy żadnych przedmiotów")) {
            // If "Title Author" failed, maybe try just "Title" in a real app,
            // but for now let's just log it.
            log.info(`Brak wyników na Vinted`, { searchText });
            sendEvent({
              type: "search_attempt",
              result: { id: book.id, title, author: book.author, url, status: "no_results", itemCount: 0, debug: { ...vintedDiagnostics(html, 0), ...memMb() } }
            });
            // Zapisz „przeskanowano, brak ofert" — utrwala pokrycie skanu (wznawialność).
            if (persistEnabled) await this.persistBookOffers(book, [], scannedAt);
            // Odczekaj jak przy każdym innym zapytaniu — pomijanie opóźnienia
            // przy braku wyników (częsty przypadek) to prosta droga do blokady
            await new Promise(resolve => setTimeout(resolve, 3000 + Math.floor(Math.random() * 2000)));
            continue;
          }

          const items = parseVintedItems(html, title, book.author || "");
          const debug = { ...vintedDiagnostics(html, items.length), ...memMb() };

          // Utrwal wynik (match lub 0 ofert) — scala ze składowanymi, zachowuje sprzedawców.
          if (persistEnabled) await this.persistBookOffers(book, items, scannedAt);

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
              result: { id: book.id, title, author: book.author, url, status: "success", itemCount: items.length, debug }
            });
            // Książka istnieje na Vinted → oznacz źródło tagiem „Vinted" (best-effort).
            // Guard po zrodlo pomija zbędny zapis dla już otagowanych (re-scan).
            if (!(book.zrodlo || []).includes("Vinted")) {
              try {
                await this.notion.addTagToMultiSelect(book.id, "Źródło", "Vinted");
              } catch (e: any) {
                log.warn("Nie udało się dodać tagu Vinted", { title: book.plTitle, error: e?.message });
              }
            }
          } else {
            sendEvent({
              type: "search_attempt",
              result: { id: book.id, title, author: book.author, url, status: "no_results", itemCount: 0, debug }
            });
          }
        } catch (err: any) {
          log.warn(`Błąd sprawdzania Vinted`, { title, error: err.message || "Nieznany błąd" });
          sendEvent({
            type: "search_attempt",
            result: { id: book.id, title, author: book.author, url, status: "error", itemCount: 0, debug: { error: err.message, code: err.code, httpStatus: err.response?.status, ...memMb() } }
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

  /**
   * Etap 2 (przyrostowo, wznawialnie): dociąga sprzedawcę do SKŁADOWANYCH ofert bez
   * sprzedawcy i zapisuje z powrotem do Notion. Rozpoznani zostają w blobie, więc kolejny
   * przebieg bierze tylko wciąż-`null`. Bez capu domyślnie: przebieg ustala WSZYSTKIE
   * brakujące (praca jest skończona — ilość nulli w bazie), ile zdąży zanim padnie; że
   * zapis idzie raz na książkę, przerwany przebieg i tak utrwala postęp. Rate chroni
   * throttling, nie liczba total. Opcjonalny `cap` ogranicza przebieg (np. z UI).
   */
  async resolveSellersToStore(
    sendEvent: (data: SyncEvent) => void,
    checkCancellation: () => boolean,
    params?: { cap?: number },
  ) {
    const CAP = params?.cap && params.cap > 0 ? params.cap : Infinity;
    try {
      sendEvent({ type: "status", message: "Wczytywanie składowanych ofert z Notion..." });
      const allBooks = await this.notion.getBooksForStats(undefined, checkCancellation, { cache: true });

      // Książki z ofertami bez sprzedawcy (offer to referencja do data.offers — mutacja wraca do blobu).
      const pending: { book: NotionBook; data: StoredVintedData; offers: StoredOffer[] }[] = [];
      let totalPending = 0;
      for (const book of allBooks) {
        const data = parseVintedData(book.vintedData);
        if (!data) continue;
        const nulls = data.offers.filter(o => o.seller == null && /\/items\//.test(o.url));
        if (nulls.length) { pending.push({ book, data, offers: nulls }); totalPending += nulls.length; }
      }

      if (totalPending === 0) {
        sendEvent({ type: "complete", result: { success: true, resolved: 0, remaining: 0, message: "Wszyscy sprzedawcy już ustaleni w bazie." } });
        return;
      }

      const target = Math.min(totalPending, CAP);
      sendEvent({
        type: "status",
        message: Number.isFinite(CAP)
          ? `Ofert bez sprzedawcy: ${totalPending}. Ten przebieg: ${target} (limit ${CAP}).`
          : `Ofert bez sprzedawcy: ${totalPending}. Ustalam wszystkie w tym przebiegu.`,
      });

      const httpsAgent = createScrapingAgent();
      let fetched = 0, resolved = 0;

      for (const p of pending) {
        if (fetched >= CAP || checkCancellation()) break;
        let dirty = false;
        for (const offer of p.offers) {
          if (fetched >= CAP || checkCancellation()) break;
          fetched++;
          sendEvent({ type: "progress", message: `Sprzedawca: ${p.book.plTitle} (${fetched}/${target})`, current: fetched, total: target });
          try {
            const response = await withRetry(async () => {
              return await axios.get(offer.url, { httpsAgent, headers: vintedRequestHeaders(), timeout: 30000 });
            }, 3, 4000);
            const html = response.data;
            if (looksBlocked(html)) {
              log.warn("Vinted zablokował stronę oferty (sprzedawca, baza)", { url: offer.url });
            } else {
              const seller = extractVintedSeller(html);
              if (seller) {
                offer.seller = seller;
                dirty = true;
                resolved++;
                sendEvent({ type: "seller_resolved", result: { url: offer.url, seller, ...memMb() } });
              }
            }
          } catch (err: any) {
            log.warn("Błąd ustalania sprzedawcy (baza)", { url: offer.url, error: err.message });
          }
          await new Promise(resolve => setTimeout(resolve, 3000 + Math.floor(Math.random() * 2000)));
        }
        // Zapisz książkę raz, po ustaleniu jej ofert (mniej zapisów do Notion).
        if (dirty) {
          try {
            await this.notion.saveVintedData(p.book.id, serializeVintedData(p.data));
          } catch (e: any) {
            log.warn("Nie udało się zapisać sprzedawców do VintedData", { title: p.book.plTitle, error: e?.message });
          }
        }
      }

      const wasCancelled = checkCancellation();
      const remaining = totalPending - resolved;
      sendEvent({
        type: "complete",
        result: {
          success: !wasCancelled, cancelled: wasCancelled, resolved, remaining,
          message: `${wasCancelled ? "Przerwano. " : ""}Ustalono sprzedawców: ${resolved}. Pozostało bez sprzedawcy: ${remaining}${remaining > 0 ? " — uruchom ponownie, by dokończyć." : "."}`,
        },
      });
    } catch (error: any) {
      log.error("Błąd ustalania sprzedawców z bazy", { message: error.message });
      sendEvent({ type: "error", error: `Błąd ustalania sprzedawców: ${error.message}` });
    }
  }
}
