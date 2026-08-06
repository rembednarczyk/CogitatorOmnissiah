import axios from "axios";
import http from "http";
import https from "https";
import { withRetry } from "./retry";

const httpAgent = new http.Agent({ keepAlive: true });
const httpsAgent = new https.Agent({ keepAlive: true });

const wikiAxios = axios.create({
  httpAgent,
  httpsAgent,
  timeout: 30000,
  headers: {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    'Accept': 'application/json, text/plain, */*',
    'Accept-Language': 'pl-PL,pl;q=0.9,en-US;q=0.8,en;q=0.7'
  }
});

export class WikiAdapter {
  private readonly baseUrl = "https://encyklopediafantastyki.pl/api.php";

  /**
   * Zwraca wikitext strony lub "" gdy strona nie istnieje.
   * Rzuca błąd przy awarii infrastruktury (blokada IP, timeout po retry) —
   * brak strony i awaria sieci to różne sytuacje i serwisy muszą je rozróżniać,
   * inaczej pełna awaria raportuje się jako pusty, "udany" sync.
   */
  async fetchPageContent(title: string): Promise<string> {
    try {
      const response = await withRetry(() => wikiAxios.get(this.baseUrl, {
        params: {
          action: "query",
          prop: "revisions",
          rvprop: "content",
          titles: title,
          redirects: 1,
          format: "json",
          formatversion: 2
        }
      }), 3, 2000);

      // Z formatversion=2 pages jest tablicą, a treść leży w rev.content;
      // obsłuż oba kształty (starsze MediaWiki ignorują formatversion)
      const pages = response.data.query?.pages;
      const page = Array.isArray(pages) ? pages[0] : pages?.[Object.keys(pages ?? {})[0]];

      if (!page || page.missing || page.invalid || !page.revisions) {
        console.warn(`Nie znaleziono strony "${title}" w encyklopedii.`);
        return "";
      }

      const rev = page.revisions[0];
      return rev.content ?? rev["*"] ?? rev.slots?.main?.content ?? "";
    } catch (error: any) {
      console.warn(`Błąd pobierania strony "${title}": ${error.message} (zablokowane IP?)`);
      throw new Error(`Nie udało się pobrać strony "${title}" z encyklopedii: ${error.message}`);
    }
  }

  async fetchPageContentWithSlots(title: string): Promise<string> {
    try {
      const response = await withRetry(() => wikiAxios.get(this.baseUrl, {
        params: {
          action: "query",
          prop: "revisions",
          rvprop: "content",
          rvslots: "main",
          titles: title,
          redirects: 1,
          format: "json"
        }
      }), 3, 2000);

      const pages = response.data.query.pages;
      const pageId = Object.keys(pages)[0];

      if (pageId === "-1") {
        console.warn(`Nie znaleziono strony "${title}" w encyklopedii.`);
        return "";
      }

      const rev = pages[pageId].revisions[0];
      return rev.slots?.main?.["*"] || rev["*"] || rev.content || "";
    } catch (error: any) {
      console.warn(`Błąd pobierania strony "${title}": ${error.message} (zablokowane IP?)`);
      return "";
    }
  }

  /**
   * Pobiera treść wielu stron. Zwraca mapę treści oraz listę tytułów,
   * których nie udało się pobrać (awaria chunka) — serwisy raportują je
   * w podsumowaniu zamiast cicho pomijać książki.
   */
  async fetchPagesContentBulk(titles: string[]): Promise<{ contents: Record<string, string>, failedTitles: string[] }> {
    const results: Record<string, string> = {};
    const failedTitles: string[] = [];

    // MediaWiki API allows up to 50 titles per request
    const chunkSize = 50;
    for (let i = 0; i < titles.length; i += chunkSize) {
      const chunk = titles.slice(i, i + chunkSize);
      const titlesParam = chunk.join('|');

      try {
        // MediaWiki tnie duże odpowiedzi (limity rozmiaru rewizji) i zwraca
        // token continue — podążaj za nim, inaczej część stron cicho przepada
        let continueParams: Record<string, string> = {};
        do {
          const response = await withRetry(() => wikiAxios.get(this.baseUrl, {
            params: {
              action: "query",
              prop: "revisions",
              rvprop: "content",
              rvslots: "main",
              titles: titlesParam,
              redirects: 1,
              format: "json",
              ...continueParams
            }
          }), 3, 2000);

          const pages = response.data.query?.pages;
          if (pages) {
            for (const pageId of Object.keys(pages)) {
              const page = pages[pageId];
              if (pageId !== "-1" && page.revisions && page.revisions.length > 0) {
                const rev = page.revisions[0];
                const content = rev.slots?.main?.["*"] || rev["*"] || rev.content || "";
                results[page.title.toLowerCase()] = content;
              }
            }
          }

          // Map normalized titles back to original requested titles
          const normalized = response.data.query?.normalized;
          if (normalized) {
            for (const norm of normalized) {
              if (results[norm.to.toLowerCase()]) {
                results[norm.from.toLowerCase()] = results[norm.to.toLowerCase()];
              }
            }
          }

          // Map redirects back to original requested titles
          const redirects = response.data.query?.redirects;
          if (redirects) {
            for (const redir of redirects) {
              if (results[redir.to.toLowerCase()]) {
                results[redir.from.toLowerCase()] = results[redir.to.toLowerCase()];
              }
            }
          }

          continueParams = response.data.continue || {};
        } while (Object.keys(continueParams).length > 0);
      } catch (error: any) {
        if (error.response?.status === 403) {
          console.warn(`Wiki API 403 Forbidden dla bulk fetch. Prawdopodobnie blokada IP.`);
        } else {
          console.warn(`Error fetching bulk pages:`, error.message);
        }
        // Continue with other chunks even if one fails, but record what was lost
        failedTitles.push(...chunk);
      }
    }

    return { contents: results, failedTitles };
  }

  async searchPage(query: string, limit: number = 3): Promise<string[]> {
    try {
      const response = await withRetry(() => wikiAxios.get(this.baseUrl, {
        params: {
          action: "query",
          list: "search",
          srsearch: query,
          srlimit: limit,
          format: "json"
        }
      }), 3, 2000);

      const results = response.data.query?.search;
      if (results && results.length > 0) {
        return results.map((r: any) => r.title);
      }
      return [];
    } catch (error: any) {
      console.warn(`Błąd wyszukiwania "${query}": ${error.message} (zablokowane IP?)`);
      return [];
    }
  }

  async fetchCategoryMembers(category: string): Promise<string[]> {
    let allTitles: string[] = [];
    let cmcontinue: string | undefined = undefined;

    try {
      do {
        const response = await withRetry(() => wikiAxios.get(this.baseUrl, {
          params: {
            action: "query",
            list: "categorymembers",
            cmtitle: category,
            cmlimit: 500,
            cmcontinue: cmcontinue,
            format: "json",
            formatversion: 2
          }
        }), 3, 2000);

        const members = response.data.query.categorymembers;
        if (members) {
          allTitles = allTitles.concat(members.map((m: any) => m.title));
        }

        cmcontinue = response.data.continue?.cmcontinue;
      } while (cmcontinue);

      return allTitles;
    } catch (error: any) {
      console.warn(`Błąd pobierania kategorii "${category}": ${error.message} (zablokowane IP?)`);
      // Zwróć to, co udało się zebrać przed awarią, zamiast wyrzucać częściowe wyniki
      return allTitles;
    }
  }

  async fetchLastRevisionDate(title: string): Promise<string> {
    try {
      const response = await withRetry(() => wikiAxios.get(this.baseUrl, {
        params: {
          action: "query",
          prop: "revisions",
          rvprop: "timestamp",
          titles: title,
          format: "json",
          formatversion: 2
        }
      }), 3, 2000);

      const query = response.data.query;
      if (!query || !query.pages) return "Nieznana";

      const pages = query.pages;
      const page = Array.isArray(pages) ? pages[0] : pages[Object.keys(pages)[0]];

      if (!page || page.missing || page.invalid) {
        return "Nieznana";
      }

      const timestamp = page.revisions?.[0]?.timestamp;
      if (!timestamp) return "Nieznana";

      return new Date(timestamp).toLocaleDateString("pl-PL", {
        year: "numeric",
        month: "2-digit",
        day: "2-digit"
      });
    } catch (error: any) {
      console.warn(`Wiki API error for "${title}": ${error.message}`);
      return "Nieznana"; // Graceful degradation for 403 Forbidden / blocks
    }
  }
}
