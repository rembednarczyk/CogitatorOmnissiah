import axios from "axios";
import https from "https";
import { getRandomUserAgent } from "../scrapingClient";
import { vintedRequestHeaders, VintedSession } from "./vintedHttp";

const VINTED_HOME = "https://www.vinted.pl/";

/**
 * Sk­leja nagłówek `Cookie` z tablicy `Set-Cookie` odpowiedzi (axios `res.headers["set-cookie"]`).
 * Bierze tylko parę `nazwa=wartość` (część przed pierwszym `;`), pomija atrybuty (Path/Expires/…)
 * i puste/wadliwe wpisy. Czysta funkcja — łatwa do testów.
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
 * „Rozgrzanie" sesji Vinted: jedno GET strony głównej realną przeglądarkową sygnaturą,
 * by przejąć ciasteczka (m.in. Cloudflare `cf_clearance` + anonimowa sesja Vinted).
 * Zwrócony UA jest STAŁY dla całego skanu — cf_clearance jest związany z UA, więc kolejne
 * żądania katalogu MUSZĄ nieść ten sam UA + Cookie. Odporne: przy błędzie / braku ciasteczek
 * zwraca pustą sesję (skan leci dalej bez primingu — jak dotąd). `validateStatus: () => true`,
 * bo Cloudflare bywa serwuje ciasteczko nawet na stronie-wyzwaniu (403).
 */
export async function primeVintedSession(
  httpsAgent: https.Agent,
  opts: { uaPool?: string[]; timeoutMs: number },
): Promise<VintedSession> {
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
    // Bez ciasteczka priming nic nie daje → pusta sesja (UA wróci do rotacji per-żądanie).
    return cookie ? { userAgent, cookie } : { userAgent: "", cookie: "" };
  } catch {
    return { userAgent: "", cookie: "" };
  }
}

/** Liczba ciasteczek w nagłówku Cookie (do komunikatu statusu). */
export function cookieCount(cookie: string): number {
  return cookie ? cookie.split(";").filter((c) => c.trim()).length : 0;
}
