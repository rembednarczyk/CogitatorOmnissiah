import https from "https";

/**
 * Shared infrastructure for the HTML-scraping scanners (library OPAC, Vinted).
 * Adapters and sync services use the Notion/Wiki API; the scanners hit public
 * HTML pages, so they need User-Agent rotation and a keep-alive HTTPS agent.
 */

// Pool of current browser versions (as of: August 2026 — Chrome 151/152,
// Firefox 154, Edge 151, Safari 26). Anti-bots penalize outdated UAs (mismatch
// with the rest of the fingerprint), so refresh the pool every few months. The format matters:
// Chrome/Edge report reduced versions x.0.0.0, Safari 26 a frozen Version/26.0,
// and the platform tokens (Windows NT 10.0, Mac OS X 10_15_7 / 10.15) are intentionally frozen
// by the browsers — don't „modernize" them.
const USER_AGENTS = [
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/152.0.0.0 Safari/537.36',
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/151.0.0.0 Safari/537.36',
  'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/151.0.0.0 Safari/537.36',
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:154.0) Gecko/20100101 Firefox/154.0',
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10.15; rv:154.0) Gecko/20100101 Firefox/154.0',
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/151.0.0.0 Safari/537.36 Edg/151.0.0.0',
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/26.0 Safari/605.1.15'
];

/** Random UA from the passed pool (config `scraping.userAgents`); without an argument — from the built-in one. */
export const getRandomUserAgent = (pool?: string[]) => {
  const list = pool && pool.length > 0 ? pool : USER_AGENTS;
  return list[Math.floor(Math.random() * list.length)];
};

export interface ScrapingAgentOptions {
  /** Max concurrent connections to a single host (default 5). */
  maxSockets?: number;
  /**
   * Defaults to `true` (full TLS verification). Set `false` ONLY for hosts
   * that misconfigure their certificate chain (e.g. don't send the intermediate
   * certificate → Node reports „unable to verify the first certificate"). The scanners
   * read EXCLUSIVELY public data (the library catalog) and don't send any
   * secrets, so the risk is negligible; still, keep it per-host, not global.
   */
  rejectUnauthorized?: boolean;
}

/** Keep-alive agent shared by the HTML scanners. */
export const createScrapingAgent = (opts: ScrapingAgentOptions = {}) => new https.Agent({
  keepAlive: true,
  keepAliveMsecs: 1000,
  timeout: 45000,
  maxSockets: opts.maxSockets ?? 5,
  rejectUnauthorized: opts.rejectUnauthorized ?? true,
});

/**
 * Hard ceiling on a scraped response body. Axios buffers the whole response in memory
 * before we ever see it, and none of the calls set a limit — so a slow-drip or
 * oversized response from any scraped host was an uncapped allocation on a 512 MB
 * instance. `withRetry` multiplies it: a configurable 6 attempts means one book could
 * pull six full-size bodies.
 *
 * 12 MB is deliberately well ABOVE the ~7 MB Vinted catalog pages this scanner is built
 * for (see the OOM history in backlog.md) — the point is to stop the pathological case,
 * not to second-guess normal traffic. Exceeding it rejects the request instead of
 * filling the heap.
 */
export const MAX_RESPONSE_BYTES = 12 * 1024 * 1024;

/** Axios options capping the buffered response — spread into every scraping call. */
export const responseSizeLimit = {
  maxContentLength: MAX_RESPONSE_BYTES,
  maxBodyLength: MAX_RESPONSE_BYTES,
};
