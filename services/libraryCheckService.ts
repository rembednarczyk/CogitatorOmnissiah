import axios from "axios";
import pLimit from "p-limit";
import { NotionAdapter } from "../notion.adapter";
import { SyncEvent } from "../src/types";
import { withRetry } from "../retry";
import { createLogger } from "../logger";
import { getRandomUserAgent, createScrapingAgent } from "../scrapingClient";
import { parseOpacResults, findBookMatch } from "./opacParser";
import { ConfigService } from "./configService";

const log = createLogger("LibraryCheck");

const REQUEST_TIMEOUT = 20000;

/**
 * Skaner dostępności w bibliotece (OPAC MBP Lublin, Prolib Integro). Dla każdej
 * nieprzeczytanej/nieposiadanej książki odpytuje OPAC zawężony do wybranej filii
 * (param f2), parsuje rekordy i szuka dopasowania KSIĄŻKI (filmy/audiobooki są
 * pomijane). Zob. docs/library-check.md i services/opacParser.ts.
 */
export class LibraryCheckService {
  constructor(private notion: NotionAdapter, private config: ConfigService) {}

  async runLibraryCheck(
    libraryCode: string,
    sendEvent: (data: SyncEvent) => void,
    checkCancellation: () => boolean,
  ) {
    // Knoby skanera (równoległość / wykluczenia / pula UA) czytane raz na przebieg.
    const cfg = await this.config.getConfig();
    const concurrency = cfg.library.concurrency;
    sendEvent({ type: "status", message: "Pobieranie listy książek z Notion..." });
    // cache: kolejne filie w „Skanuj wszystkie" współdzielą jedno pobranie z Notion.
    const allBooks = await this.notion.getBooksForStats(undefined, checkCancellation, { cache: true });

    // Kandydaci: mają polski tytuł i NIE są już przeczytane/posiadane/w bibliotece.
    const candidates = allBooks.filter((b) => {
      const zrodlo = b.zrodlo || [];
      return !zrodlo.some((z) => cfg.library.excludedSources.includes(z)) && b.plTitle && b.plTitle.trim() !== "";
    });

    sendEvent({ type: "status", message: `Znaleziono ${candidates.length} kandydatów do sprawdzenia...` });

    const results: any[] = [];
    // OPAC MBP Lublin nie wysyła certyfikatu pośredniego → Node zgłasza „unable to
    // verify the first certificate" i każde żądanie leci wyjątkiem. Wyłączamy
    // weryfikację TLS tylko dla tego agenta (czytamy publiczny katalog, bez sekretów).
    const httpsAgent = createScrapingAgent({ rejectUnauthorized: false, maxSockets: concurrency });
    const limit = pLimit(concurrency);
    let processed = 0;

    const tasks = candidates.map((book) =>
      limit(async () => {
        if (checkCancellation()) return;

        const title = book.plTitle;
        const url = `https://opac.mbp.lublin.pl/search/description?q=${encodeURIComponent(title)}&index=1&scope=full&f2%5B0%5D=${encodeURIComponent(libraryCode)}`;
        const headers = {
          "User-Agent": getRandomUserAgent(cfg.scraping.userAgents),
          "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
          "Accept-Language": "pl-PL,pl;q=0.9,en-US;q=0.8,en;q=0.7",
          "Cache-Control": "no-cache",
        };

        try {
          const response = await withRetry(
            () => axios.get(url, { httpsAgent, headers, timeout: REQUEST_TIMEOUT }),
            2,
            1500,
          );

          const records = parseOpacResults(response.data);
          const match = findBookMatch(records, book.plTitle, book.author || "");

          if (match) {
            const matchResult = {
              id: book.id,
              title: book.plTitle,
              author: book.author,
              year: book.year,
              extractedTitle: match.title,
              extractedAuthor: match.author,
            };
            results.push(matchResult);
            sendEvent({ type: "match", result: matchResult });
          }
        } catch (err: any) {
          log.warn("Błąd sprawdzania książki w bibliotece", { title, error: err.message || "Nieznany błąd" });
          sendEvent({
            type: "status",
            message: `⚠️ Błąd sprawdzania "${title}": ${err.message || "Timeout/Błąd sieci"}. Kontynuuję...`,
          });
        } finally {
          processed++;
          sendEvent({
            type: "progress",
            message: `Sprawdzono ${processed}/${candidates.length} (znaleziono ${results.length})`,
            current: processed,
            total: candidates.length,
          });
        }
      }),
    );

    await Promise.all(tasks);

    const wasCancelled = checkCancellation();
    sendEvent({
      type: "complete",
      result: {
        success: !wasCancelled,
        cancelled: wasCancelled,
        results,
        message: wasCancelled
          ? `Skanowanie przerwane. Znaleziono ${results.length} książek przed przerwaniem.`
          : `Zakończono sprawdzanie. Znaleziono ${results.length} książek.`,
      },
    });
  }
}
