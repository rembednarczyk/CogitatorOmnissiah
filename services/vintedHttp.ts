import { getRandomUserAgent } from "../scrapingClient";

/** Nagłówki żądania Vinted (świeży User-Agent na wywołanie). Wspólne dla skanu i grupowania. */
export function vintedRequestHeaders() {
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
export function memMb() {
  const m = process.memoryUsage();
  return { rssMb: Math.round(m.rss / 1048576), heapMb: Math.round(m.heapUsed / 1048576) };
}

/**
 * Odczekanie między żądaniami z jitterem (domyślnie 3–5 s). Stosowane na KAŻDEJ
 * ścieżce (też przy braku wyników) — burst żądań to prosta droga do bloku Cloudflare.
 */
export function throttle(minMs = 3000, jitterMs = 2000): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, minMs + Math.floor(Math.random() * jitterMs)));
}

/**
 * Mapuje błąd HTTP Vinted na komunikat dla UI + ewentualne dodatkowe odczekanie.
 * 429 = rate-limit (odczekaj 5 s), 403 = Cloudflare (leć dalej), reszta = timeout/inne.
 */
export function classifyVintedError(err: any, title: string): { message: string; waitMs: number } {
  const status = err?.response?.status;
  if (status === 429) return { message: `🛑 Vinted zablokował zapytania (429). Odczekaj chwilę...`, waitMs: 5000 };
  if (status === 403) return { message: `🛡️ Vinted zablokował dostęp (403 - Cloudflare). Próbuję dalej...`, waitMs: 0 };
  return { message: `⚠️ Błąd Vinted dla "${title}": ${err?.message || "Timeout"}. Kontynuuję...`, waitMs: 0 };
}
