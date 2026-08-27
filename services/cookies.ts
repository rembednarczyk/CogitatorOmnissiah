/**
 * Assembles the `Cookie` header from a response's `Set-Cookie` array (axios
 * `res.headers["set-cookie"]`). Takes only the `name=value` pair (before the
 * first `;`), skips attributes (Path/Expires/…) and empty/malformed entries.
 * Pure function — lives in its own module so `vintedSession` and `browserPrime`
 * both depend on it without forming an import cycle.
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
