import { getRandomUserAgent } from "../scrapingClient";

/** A warmed-up Vinted session: a fixed User-Agent + cookies (incl. Cloudflare `cf_clearance`). */
export interface VintedSession {
  /** UA used for priming — MUST be consistent with requests carrying the cookie (cf_clearance is bound to the UA). */
  userAgent: string;
  /** The `Cookie` header (e.g. „cf_clearance=…; anon_id=…"). Empty = no session. */
  cookie: string;
}

/**
 * Vinted request headers. Without a session: a fresh random User-Agent per call (pool from
 * config). With a warmed-up session: a FIXED UA + `Cookie` (consistency required by
 * Cloudflare — cf_clearance is bound to the UA, so rotating the UA would invalidate the cookie).
 */
export function vintedRequestHeaders(uaPool?: string[], session?: VintedSession) {
  const headers: Record<string, string> = {
    'User-Agent': session?.userAgent || getRandomUserAgent(uaPool),
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
  if (session?.cookie) headers['Cookie'] = session.cookie;
  return headers;
}

/**
 * Reads process memory (MB). Vinted pages are ~7 MB of HTML each — on hosting with
 * a RAM cap (Render free = 512 MB) repeated spikes during parsing can trigger an
 * OOM-kill of the process, which cuts the SSE and „kills" the scan at a roughly constant number of tries.
 * We attach `rssMb`/`heapMb` to each attempt's debug so this is visible in the logs panel.
 */
export function memMb() {
  const m = process.memoryUsage();
  return { rssMb: Math.round(m.rss / 1048576), heapMb: Math.round(m.heapUsed / 1048576) };
}

/**
 * Wait between requests with jitter (default 3–5 s). Applied on EVERY
 * path (including no results) — a burst of requests is a straight road to a Cloudflare block.
 */
export function throttle(minMs = 3000, jitterMs = 2000): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, minMs + Math.floor(Math.random() * jitterMs)));
}

/**
 * Maps a Vinted HTTP error to a UI message + an optional extra wait.
 * 429 = rate-limit (wait 5 s), 403 = Cloudflare (carry on), the rest = timeout/other.
 */
export function classifyVintedError(err: any, title: string): { message: string; waitMs: number } {
  const status = err?.response?.status;
  if (status === 429) return { message: `🛑 Vinted zablokował zapytania (429). Odczekaj chwilę...`, waitMs: 5000 };
  if (status === 403) return { message: `🛡️ Vinted zablokował dostęp (403 - Cloudflare). Próbuję dalej...`, waitMs: 0 };
  return { message: `⚠️ Błąd Vinted dla "${title}": ${err?.message || "Timeout"}. Kontynuuję...`, waitMs: 0 };
}
