import { Request, Response, NextFunction } from "express";
import crypto from "crypto";

function safeEqual(a: string, b: string): boolean {
  const ab = Buffer.from(a);
  const bb = Buffer.from(b);
  if (ab.length !== bb.length) return false;
  return crypto.timingSafeEqual(ab, bb);
}

/**
 * HTTP Basic Auth — opt-in in development, FAIL-CLOSED in production.
 *
 * Active whenever BOTH BASIC_AUTH_USER and BASIC_AUTH_PASSWORD are set.
 * `/api/health` is always open (hosting health check).
 *
 * WHAT HAPPENS WITHOUT CREDENTIALS. This used to `next()` unconditionally, which made
 * "no protection" the default state — and `render.yaml` declares both variables with
 * `sync: false`, i.e. the blueprint does NOT provision them. A fresh deploy therefore
 * came up serving every Notion-mutating endpoint to the internet, silently. Now:
 *
 *   - development / tests → still a no-op, so local work needs no setup;
 *   - production          → 503 on everything but the health probe.
 *
 * The refusal is deliberately loud-but-recoverable rather than a boot failure: the
 * health probe keeps answering (so the host doesn't flap the service) while nothing
 * else is served, and setting the two variables fixes it without a redeploy of code.
 * A genuinely public deployment is still possible — but it now takes an explicit,
 * auditable `ALLOW_PUBLIC_ACCESS=true` instead of an omission nobody notices.
 *
 * Protects the whole service (SPA + API): the browser shows the native prompt, and
 * same-origin `fetch` from the SPA automatically attaches credentials after login.
 */
export function basicAuth(getEnv: () => NodeJS.ProcessEnv = () => process.env) {
  return (req: Request, res: Response, next: NextFunction) => {
    const env = getEnv();
    const user = env.BASIC_AUTH_USER;
    const pass = env.BASIC_AUTH_PASSWORD;

    // The health check must be reachable without logging in (hosting monitoring),
    // in every branch below — including the fail-closed one.
    if (req.path === "/api/health") return next();

    if (!user || !pass) {
      const openOnPurpose = env.ALLOW_PUBLIC_ACCESS === "true";
      if (env.NODE_ENV === "production" && !openOnPurpose) {
        return res.status(503).send(
          "Serwis nie jest skonfigurowany: brak BASIC_AUTH_USER / BASIC_AUTH_PASSWORD. " +
          "Ustaw je, albo świadomie wystaw publicznie przez ALLOW_PUBLIC_ACCESS=true."
        );
      }
      return next(); // dev/test, or an explicit opt-out
    }

    const header = req.headers.authorization || "";
    const [scheme, encoded] = header.split(" ");
    if (scheme === "Basic" && encoded) {
      const decoded = Buffer.from(encoded, "base64").toString("utf8");
      const sep = decoded.indexOf(":");
      if (sep !== -1) {
        const u = decoded.slice(0, sep);
        const p = decoded.slice(sep + 1);
        if (safeEqual(u, user) && safeEqual(p, pass)) return next();
      }
    }

    res.setHeader("WWW-Authenticate", 'Basic realm="Cogitator Omnissiah", charset="UTF-8"');
    return res.status(401).send("Wymagana autoryzacja.");
  };
}
