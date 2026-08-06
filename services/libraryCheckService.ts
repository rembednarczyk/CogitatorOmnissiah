import axios from "axios";
import { NotionAdapter } from "../notion.adapter";
import { SyncEvent } from "../src/types";
import { cleanTitle, calculateSimilarity, normalizeAuthor } from "../utils";
import { withRetry } from "../retry";
import { createLogger } from "../logger";
import { getRandomUserAgent, createScrapingAgent } from "../scrapingClient";

const log = createLogger("LibraryCheck");

/**
 * Skaner dostępności w bibliotece (OPAC MBP Lublin). Scrapuje HTML wyszukiwarki
 * dla każdej książki, która nie jest jeszcze oznaczona jako posiadana/przeczytana,
 * i emituje trafienia przez SSE. Zob. docs/library-check.md.
 */
export class LibraryCheckService {
  constructor(private notion: NotionAdapter) {}

  async runLibraryCheck(
    libraryCode: string,
    sendEvent: (data: SyncEvent) => void,
    checkCancellation: () => boolean,
  ) {
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
    const httpsAgent = createScrapingAgent();

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
        log.warn(`Błąd sprawdzania książki w bibliotece`, { title, error: err.message || "Nieznany błąd" });
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
  }
}
