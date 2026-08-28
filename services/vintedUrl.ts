/**
 * Host allow-list for Vinted URLs — the trust boundary for scraped links.
 *
 * WHY THIS EXISTS. The scraper's parser guarantees that every offer URL points at
 * Vinted (it prefixes relative paths with the Vinted origin), but that guarantee was
 * enforced only on INGEST and silently dropped on RELOAD: `parseVintedData` re-hydrated
 * the blob from Notion and passed `offers` through untouched. Two consequences:
 *
 *  1. SSRF — the seller-resolve pass re-fetches `offer.url` and attaches the warmed
 *     Cloudflare session cookie. The only filter was `/\/items\//.test(url)`, a
 *     SUBSTRING test, so `http://169.254.169.254/items/` passed and was fetched from
 *     inside the host network, with the response parsed and written back.
 *  2. The same unvalidated strings render as `href`/`src` in the UI.
 *
 * So the check belongs on the HOST, not on a path fragment, and it has to run on the
 * way OUT of storage as well as on the way in. `isValidUrl` (utils.ts) only checks the
 * protocol, which is not enough here.
 */

/** Offer and seller-profile links live on the Vinted site itself. */
const SITE_HOSTS = ["vinted.pl"];
/** Offer thumbnails are served from the Vinted image CDN (e.g. images1.vinted.net). */
const PHOTO_HOSTS = ["vinted.pl", "vinted.net"];

/**
 * Exact-or-subdomain match. `endsWith("." + base)` (rather than a bare `endsWith`)
 * is what stops `evilvinted.pl` / `vinted.pl.attacker.com` from passing.
 */
function hostMatches(hostname: string, bases: string[]): boolean {
  const h = hostname.toLowerCase();
  return bases.some((b) => h === b || h.endsWith(`.${b}`));
}

function hostAllowed(value: unknown, bases: string[]): boolean {
  if (typeof value !== "string" || value === "") return false;
  let parsed: URL;
  try {
    parsed = new URL(value);
  } catch {
    return false; // relative/garbage/`javascript:alert(1)` without a parseable form
  }
  // Reject every non-web scheme (javascript:, data:, file:, gopher:…). A `javascript:`
  // URL also has an empty hostname, so the host check below would catch it anyway —
  // this is the explicit belt to that suspenders.
  if (parsed.protocol !== "https:" && parsed.protocol !== "http:") return false;
  return hostMatches(parsed.hostname, bases);
}

/** True only for an http(s) URL on vinted.pl (or a subdomain) — offers and seller profiles. */
export function isVintedUrl(value: unknown): value is string {
  return hostAllowed(value, SITE_HOSTS);
}

/** True only for an http(s) URL on a Vinted host serving images (vinted.net / vinted.pl). */
export function isVintedPhotoUrl(value: unknown): value is string {
  return hostAllowed(value, PHOTO_HOSTS);
}
