import axios from "axios";
import https from "https";
import { getRandomUserAgent } from "../scrapingClient";
import { vintedRequestHeaders, VintedSession } from "./vintedHttp";
import { primeWithBrowser } from "./browserPrime";

const VINTED_HOME = "https://www.vinted.pl/";

/**
 * Assembles the `Cookie` header from a response's `Set-Cookie` array (axios `res.headers["set-cookie"]`).
 * Takes only the `name=value` pair (the part before the first `;`), skips attributes (Path/Expires/…)
 * and empty/malformed entries. Pure function — easy to test.
 */
export function parseSetCookie(setCookie: string[] | undefined | null): string {
  if (!Array.isArray(setCookie)) return "";
  const pairs: string[] = [];
  const seen = new Set<string>();
  for (const raw of setCookie) {
    if (typeof raw !== "string") continue;
    const pair = raw.split(";")[0]?.trim();
    if (!pair || !pair.includes("=")) continue;
    const name = pair.slice(0, pair.indexOf("=")).trim();
    if (!name || seen.has(name)) continue;
    seen.add(name);
    pairs.push(pair);
  }
  return pairs.join("; ");
}

/**
 * „Warming up" a Vinted session: one GET of the home page with a real browser signature,
 * to pick up cookies (incl. Cloudflare `cf_clearance` + an anonymous Vinted session).
 * The returned UA is FIXED for the whole scan — cf_clearance is bound to the UA, so subsequent
 * catalog requests MUST carry the same UA + Cookie. Resilient: on error / missing cookies it
 * returns an empty session (the scan carries on without priming — as before). `validateStatus: () => true`,
 * because Cloudflare sometimes serves a cookie even on the challenge page (403).
 */
export async function primeVintedSession(
  httpsAgent: https.Agent,
  opts: { uaPool?: string[]; timeoutMs: number; useBrowser?: boolean },
): Promise<VintedSession> {
  // Anti-block point 2: try a headless browser first (solves Cloudflare's JS challenge for a
  // real cf_clearance). Best-effort — no browser / no clearance → fall through to the plain GET.
  if (opts.useBrowser) {
    const browserSession = await primeWithBrowser({ timeoutMs: opts.timeoutMs });
    if (browserSession?.cookie) return browserSession;
  }
  const userAgent = getRandomUserAgent(opts.uaPool);
  try {
    const res = await axios.get(VINTED_HOME, {
      httpsAgent,
      headers: vintedRequestHeaders(undefined, { userAgent, cookie: "" }),
      timeout: opts.timeoutMs,
      maxRedirects: 5,
      validateStatus: () => true,
    });
    const cookie = parseSetCookie(res.headers?.["set-cookie"] as string[] | undefined);
    // Without a cookie, priming does nothing → empty session (UA falls back to per-request rotation).
    return cookie ? { userAgent, cookie } : { userAgent: "", cookie: "" };
  } catch {
    return { userAgent: "", cookie: "" };
  }
}

/** Number of cookies in the Cookie header (for the status message). */
export function cookieCount(cookie: string): number {
  return cookie ? cookie.split(";").filter((c) => c.trim()).length : 0;
}
