import https from "https";

/**
 * Wspólna infrastruktura dla skanerów scrapujących HTML (Biblioteka OPAC, Vinted).
 * Adaptery i serwisy sync korzystają z Notion/Wiki API; skanery uderzają w publiczne
 * strony HTML, więc potrzebują rotacji User-Agent i keep-alive agenta HTTPS.
 */

// Pula bieżących wersji przeglądarek (stan: sierpień 2026 — Chrome 151/152,
// Firefox 154, Edge 151, Safari 26). Anty-boty punktują przestarzałe UA (rozjazd
// z resztą fingerprintu), więc odświeżaj pulę co kilka miesięcy. Format ma znaczenie:
// Chrome/Edge raportują zredukowane wersje x.0.0.0, Safari 26 zamrożone Version/26.0,
// a tokeny platform (Windows NT 10.0, Mac OS X 10_15_7 / 10.15) są celowo zamrożone
// przez przeglądarki — nie „unowocześniać" ich.
const USER_AGENTS = [
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/152.0.0.0 Safari/537.36',
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/151.0.0.0 Safari/537.36',
  'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/151.0.0.0 Safari/537.36',
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:154.0) Gecko/20100101 Firefox/154.0',
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10.15; rv:154.0) Gecko/20100101 Firefox/154.0',
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/151.0.0.0 Safari/537.36 Edg/151.0.0.0',
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/26.0 Safari/605.1.15'
];

export const getRandomUserAgent = () => USER_AGENTS[Math.floor(Math.random() * USER_AGENTS.length)];

export interface ScrapingAgentOptions {
  /** Maks. równoległych połączeń do jednego hosta (domyślnie 5). */
  maxSockets?: number;
  /**
   * Domyślnie `true` (pełna weryfikacja TLS). Ustaw `false` TYLKO dla hostów,
   * które błędnie konfigurują łańcuch certyfikatów (np. nie wysyłają certyfikatu
   * pośredniego → Node zgłasza „unable to verify the first certificate"). Skanery
   * czytają WYŁĄCZNIE publiczne dane (katalog biblioteki) i nie wysyłają żadnych
   * sekretów, więc ryzyko jest znikome; mimo to trzymaj to per-host, nie globalnie.
   */
  rejectUnauthorized?: boolean;
}

/** Keep-alive agent współdzielony przez skanery HTML. */
export const createScrapingAgent = (opts: ScrapingAgentOptions = {}) => new https.Agent({
  keepAlive: true,
  keepAliveMsecs: 1000,
  timeout: 45000,
  maxSockets: opts.maxSockets ?? 5,
  rejectUnauthorized: opts.rejectUnauthorized ?? true,
});
