import axios from "axios";
import { NotionAdapter } from "../notion.adapter";
import { SyncEvent } from "../src/types";
import { withRetry } from "../retry";
import { createLogger } from "../logger";
import { createScrapingAgent } from "../scrapingClient";
import { parseVintedItems, vintedDiagnostics, looksBlocked, looksEmpty, extractVintedSeller, VintedItem } from "./vintedParser";
import { NotionBook } from "../src/types";
import { offerFromItem, parseVintedData, mergeAndDiff, serializeVintedData, computeChangedAt, toStoredBookView, StoredVintedData, StoredOffer, StoredBookView, OfferDiff, EMPTY_DIFF } from "./vintedStore";
import { selectAndOrderCandidates } from "./vintedScanPlanner";
import { vintedRequestHeaders, memMb, throttle, classifyVintedError, VintedSession } from "./vintedHttp";
import { primeVintedSession, cookieCount } from "./vintedSession";
import { ConfigService } from "./configService";
import { AppConfig } from "../src/configSchema";

const log = createLogger("VintedScan");

/** Vinted catalog URL built from config knobs (category/language/price/currency/sorting). */
function buildCatalogUrl(v: AppConfig["vinted"], searchText: string): string {
  return `https://www.vinted.pl/catalog?catalog[]=${v.catalogId}&language_book_ids[]=${v.languageId}&page=1&order=${encodeURIComponent(v.order)}&price_from=${v.priceFrom}&currency=${v.currency}&search_text=${encodeURIComponent(searchText)}`;
}

/**
 * Vinted offer scanner (a direct HTML scraper — NOT AI). For each book
 * we don't yet own, it searches the Vinted catalog for offers and emits
 * hits over SSE. A thin orchestrator — the scan plan (`vintedScanPlanner`),
 * HTTP/throttling (`vintedHttp`), parsing (`vintedParser`) and merge/diff
 * (`vintedStore`) live in pure helpers. See docs/vinted-scanner.md.
 */
export class VintedSyncService {
  constructor(private notion: NotionAdapter, private config: ConfigService) {}

  /**
   * Stage 3: reads stored Vinted results from all books (VintedData blob) for
   * rendering tiles/bundles from the database — no re-scrape. Returns only books with offers.
   */
  async getStoredData(): Promise<{ books: StoredBookView[]; generatedAt: string }> {
    const allBooks = await this.notion.getBooksForStats(undefined, undefined, { cache: true });
    const books: StoredBookView[] = [];
    for (const b of allBooks) {
      const data = parseVintedData(b.vintedData);
      if (!data || data.offers.length === 0) continue;
      books.push(toStoredBookView(b, data));
    }
    return { books, generatedAt: new Date().toISOString() };
  }

  /**
   * Saves a book's freshly scanned offers to Notion (VintedData blob), merging with the
   * stored ones — preserves the recognized seller for offers whose URL still exists.
   * Best-effort: a write error doesn't stop the scan (data in the database is a bonus, not a condition).
   */
  private async persistBookOffers(book: NotionBook, items: VintedItem[], scannedAt: string): Promise<OfferDiff> {
    try {
      const fresh = items.map(offerFromItem);
      const prevData = parseVintedData(book.vintedData);
      const { offers, diff } = mergeAndDiff(fresh, prevData?.offers, scannedAt);
      const changedAt = computeChangedAt(prevData, diff, scannedAt);
      await this.notion.saveVintedData(book.id, serializeVintedData({ scannedAt, changedAt, offers }));
      return diff;
    } catch (e: any) {
      log.warn("Nie udało się zapisać VintedData", { title: book.plTitle, error: e?.message });
      return EMPTY_DIFF;
    }
  }

  /**
   * Persists an EMPTY record only for this book's first scan. When something was already
   * stored, it does NOT wipe offers/sellers (the „no results"/0-offers marker is sometimes false
   * on a page with offers — same behavior as on a silent miss).
   */
  private async persistEmptyIfNew(book: NotionBook, scannedAt: string, persistEnabled: boolean, warnMsg: string): Promise<void> {
    const hadStored = (parseVintedData(book.vintedData)?.offers.length ?? 0) > 0;
    if (persistEnabled && !hadStored) {
      await this.persistBookOffers(book, [], scannedAt);
    } else if (hadStored) {
      log.warn(warnMsg, { title: book.plTitle });
    }
  }

  async runVintedCheck(
    sendEvent: (data: SyncEvent) => void,
    checkCancellation: () => boolean,
    params?: { skipScannedWithinHours?: number },
  ) {
    try {
      // Scanner knobs (throttle/URL/retry/UA/exclusions) read once per run.
      const cfg = await this.config.getConfig();
      const v = cfg.vinted;
      sendEvent({ type: "status", message: "Pobieranie listy książek z Notion..." });
      // cache: share the fetch with neighboring scans (library/Vinted).
      const allBooks = await this.notion.getBooksForStats(undefined, checkCancellation, { cache: true });

      const skipHours = params?.skipScannedWithinHours;
      const { candidates, skipped } = selectAndOrderCandidates(allBooks, skipHours, Date.now(), v.excludedSources);
      if (skipHours && skipHours > 0 && skipped > 0) {
        sendEvent({ type: "status", message: `Wznawianie: pominięto ${skipped} skanowanych < ${skipHours} h. Do sprawdzenia: ${candidates.length}.` });
      }
      sendEvent({ type: "status", message: `Znaleziono ${candidates.length} kandydatów do sprawdzenia (od najstarszych) na Vinted...` });

      const results: any[] = [];
      const httpsAgent = createScrapingAgent();

      // Warm up the session (Cloudflare cookie) ONCE per scan — real requests then carry
      // a fixed UA + Cookie. Resilient: no cookies → the scan runs without priming (as before).
      let session: VintedSession = { userAgent: "", cookie: "" };
      if (v.primeSession && candidates.length > 0) {
        sendEvent({ type: "status", message: "Rozgrzewanie sesji Vinted (ciasteczko Cloudflare)..." });
        session = await primeVintedSession(httpsAgent, { uaPool: cfg.scraping.userAgents, timeoutMs: v.requestTimeoutMs });
        sendEvent({ type: "status", message: session.cookie
          ? `Sesja Vinted rozgrzana (${cookieCount(session.cookie)} ciasteczek, stały UA). Skanuję...`
          : "Nie udało się rozgrzać sesji (brak ciasteczek) — skanuję bez primingu." });

        // SELF-HEAL: a warmed-up session (Cookie + fixed UA) can change the VARIANT of the page
        // Vinted serves — if it's a page without catalog structure, the parser would drop
        // ALL offers (200 OK, but 0 books). One validation probe: when the page is
        // not blocked AND has no catalog structure at all (JSON/feed-grid/`/items/`),
        // we drop the session and scan without priming (priming may help, never harm).
        if (session.cookie) {
          try {
            const probeUrl = buildCatalogUrl(v, `${candidates[0].plTitle} ${candidates[0].author || ""}`.trim());
            const probe = await axios.get(probeUrl, { httpsAgent, headers: vintedRequestHeaders(cfg.scraping.userAgents, session), timeout: v.requestTimeoutMs });
            const ph: string = probe.data;
            const d = vintedDiagnostics(ph, 0);
            const usable = looksBlocked(ph) || d.noResultsMarker || d.hasCatalogJson || d.hasFeedGrid || d.itemLinks > 0;
            if (!usable) {
              session = { userAgent: "", cookie: "" };
              sendEvent({ type: "status", message: "Rozgrzana sesja zwraca stronę bez katalogu — porzucam priming, skanuję bez sesji." });
            }
            await throttle(v.throttleMinMs, v.throttleJitterMs);
          } catch {
            // A probe error isn't decisive — keep the session, the actual scan has retry/diagnostics anyway.
          }
        }
      }

      // Ensure the storage field once per scan; if it fails — persistence off (the scan runs anyway).
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

        sendEvent({
          type: "progress",
          message: `Sprawdzanie Vinted: ${searchText} (${i + 1}/${candidates.length})`,
          current: i + 1,
          total: candidates.length,
        });

        const url = buildCatalogUrl(v, searchText);

        sendEvent({ type: "search_attempt", result: { id: book.id, title: book.plTitle, author: book.author, url, status: "pending", itemCount: 0 } });

        try {
          const response = await withRetry(async () => axios.get(url, { httpsAgent, headers: vintedRequestHeaders(cfg.scraping.userAgents, session), timeout: v.requestTimeoutMs }), v.retryAttempts, v.retryBackoffMs);

          const html = response.data;
          log.info(`Odpowiedź Vinted`, { title, chars: html.length, ...memMb() });

          // Block = a SMALL challenge page, not just the word in huge HTML.
          if (looksBlocked(html)) {
            log.warn(`Vinted zablokował żądanie (wykrycie bota)`, { title });
            sendEvent({ type: "status", message: `⚠️ Vinted wykrył bota przy "${title}". Próbuję ominąć...` });
            sendEvent({ type: "search_attempt", result: { id: book.id, title, author: book.author, url, status: "blocked", itemCount: 0, debug: { ...vintedDiagnostics(html, 0), ...memMb() } } });
            // A block is NOT „no offers": we don't store emptiness or scannedAt, so a resume retries this book.
            await throttle(v.throttleMinMs, v.throttleJitterMs);
            continue;
          }

          if (looksEmpty(html)) {
            log.info(`Brak wyników na Vinted`, { searchText });
            sendEvent({ type: "search_attempt", result: { id: book.id, title, author: book.author, url, status: "no_results", itemCount: 0, debug: { ...vintedDiagnostics(html, 0), ...memMb() } } });
            await this.persistEmptyIfNew(book, scannedAt, persistEnabled, "Marker 'Brak wyników' mimo zapisanych ofert — pomijam zapis (możliwy fałszywy marker)");
            await throttle(v.throttleMinMs, v.throttleJitterMs);
            continue;
          }

          const items = parseVintedItems(html, title, book.author || "");
          const debug = { ...vintedDiagnostics(html, items.length), ...memMb() };

          if (items.length > 0) {
            // Persist (merges with the stored ones — keeps sellers on unchanged URLs) + compute the diff.
            const diff = persistEnabled ? await this.persistBookOffers(book, items, scannedAt) : EMPTY_DIFF;
            const matchResult = { id: book.id, title: book.plTitle, author: book.author, searchUrl: url, vintedItems: items, partOfCycle: book.currentCzesccyklu, cykl: book.cykl, cyklNr: book.cyklNr };
            results.push(matchResult);
            sendEvent({ type: "match", result: matchResult });
            sendEvent({ type: "search_attempt", result: { id: book.id, title, author: book.author, url, status: "success", itemCount: items.length, debug: { ...debug, changes: diff } } });
            // The book exists on Vinted → tag the source with „Vinted" (best-effort, skip if already present).
            if (!(book.zrodlo || []).includes("Vinted")) {
              try {
                await this.notion.addTagToMultiSelect(book.id, "Źródło", "Vinted");
              } catch (e: any) {
                log.warn("Nie udało się dodać tagu Vinted", { title: book.plTitle, error: e?.message });
              }
            }
          } else {
            // 0 offers WITHOUT a marker and without a block: genuinely empty OR a silent parser miss.
            await this.persistEmptyIfNew(book, scannedAt, persistEnabled, "0 ofert mimo zapisanych wcześniej — pomijam zapis (możliwy miss/blok), zachowuję dane");
            sendEvent({ type: "search_attempt", result: { id: book.id, title, author: book.author, url, status: "no_results", itemCount: 0, debug } });
          }
        } catch (err: any) {
          log.warn(`Błąd sprawdzania Vinted`, { title, error: err.message || "Nieznany błąd" });
          sendEvent({ type: "search_attempt", result: { id: book.id, title, author: book.author, url, status: "error", itemCount: 0, debug: { error: err.message, code: err.code, httpStatus: err.response?.status, ...memMb() } } });
          const { message, waitMs } = classifyVintedError(err, title);
          sendEvent({ type: "status", message });
          if (waitMs) await new Promise((resolve) => setTimeout(resolve, waitMs));
        }

        // Gap between requests (with jitter) — on EVERY path, to avoid triggering a block.
        await throttle(v.throttleMinMs, v.throttleJitterMs);
      }

      const wasCancelled = checkCancellation();
      sendEvent({ type: "complete", result: { success: !wasCancelled, cancelled: wasCancelled, results, message: wasCancelled ? `Skanowanie Vinted przerwane. Znaleziono oferty dla ${results.length} książek przed przerwaniem.` : `Zakończono skanowanie Vinted. Znaleziono oferty dla ${results.length} książek.` } });
    } catch (error: any) {
      log.error("Błąd inicjalizacji Vinted", { message: error.message });
      sendEvent({ type: "error", error: `Błąd inicjalizacji Vinted: ${error.message}` });
    }
  }

  /**
   * Stage 2 (incremental, resumable): fetches the seller for STORED offers without
   * a seller and writes them back to Notion. Recognized ones stay in the blob, so the next
   * run takes only still-`null` ones. No cap by default: a run resolves ALL
   * missing ones, as many as it manages before dying (a write per book persists progress). An optional
   * `cap` limits the run (e.g. from the UI).
   */
  async resolveSellersToStore(
    sendEvent: (data: SyncEvent) => void,
    checkCancellation: () => boolean,
    params?: { cap?: number },
  ) {
    // Cap: request parameter > config knob (`sellerResolveCap`; 0 = no limit).
    const cfg = await this.config.getConfig();
    const v = cfg.vinted;
    const capKnob = params?.cap && params.cap > 0 ? params.cap : v.sellerResolveCap;
    const CAP = capKnob > 0 ? capKnob : Infinity;
    try {
      sendEvent({ type: "status", message: "Wczytywanie składowanych ofert z Notion..." });
      const allBooks = await this.notion.getBooksForStats(undefined, checkCancellation, { cache: true });

      // Books with offers lacking a seller (offer is a reference into data.offers — the mutation flows back to the blob).
      const pending: { book: NotionBook; data: StoredVintedData; offers: StoredOffer[] }[] = [];
      let totalPending = 0;
      for (const book of allBooks) {
        const data = parseVintedData(book.vintedData);
        if (!data) continue;
        const nulls = data.offers.filter((o) => o.seller == null && /\/items\//.test(o.url));
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

      // Session priming here too — offer pages (`/items/…`) are behind the same Cloudflare.
      let session: VintedSession = { userAgent: "", cookie: "" };
      if (v.primeSession) {
        sendEvent({ type: "status", message: "Rozgrzewanie sesji Vinted (ciasteczko Cloudflare)..." });
        session = await primeVintedSession(httpsAgent, { uaPool: cfg.scraping.userAgents, timeoutMs: v.requestTimeoutMs });
      }

      let fetched = 0, resolved = 0;

      for (const p of pending) {
        if (fetched >= CAP || checkCancellation()) break;
        let dirty = false;
        for (const offer of p.offers) {
          if (fetched >= CAP || checkCancellation()) break;
          fetched++;
          sendEvent({ type: "progress", message: `Sprzedawca: ${p.book.plTitle} (${fetched}/${target})`, current: fetched, total: target });
          try {
            const response = await withRetry(async () => axios.get(offer.url, { httpsAgent, headers: vintedRequestHeaders(cfg.scraping.userAgents, session), timeout: v.requestTimeoutMs }), v.retryAttempts, v.retryBackoffMs);
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
          await throttle(v.throttleMinMs, v.throttleJitterMs);
        }
        // Save the book once, after resolving its offers (fewer writes to Notion).
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
