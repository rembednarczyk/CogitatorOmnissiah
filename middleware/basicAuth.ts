import { Request, Response, NextFunction } from "express";
import crypto from "crypto";

function safeEqual(a: string, b: string): boolean {
  const ab = Buffer.from(a);
  const bb = Buffer.from(b);
  if (ab.length !== bb.length) return false;
  return crypto.timingSafeEqual(ab, bb);
}

/**
 * Opt-in HTTP Basic Auth.
 *
 * Active only when BOTH BASIC_AUTH_USER and BASIC_AUTH_PASSWORD are set —
 * otherwise the middleware lets everything through
 * (default behavior, no lockout of an existing deployment).
 * `/api/health` is always open (hosting health check).
 *
 * Protects the whole service (SPA + API): the browser shows the native prompt, and
 * same-origin `fetch` from the SPA automatically attaches credentials after login.
 */
export function basicAuth(getEnv: () => NodeJS.ProcessEnv = () => process.env) {
  return (req: Request, res: Response, next: NextFunction) => {
    const env = getEnv();
    const user = env.BASIC_AUTH_USER;
    const pass = env.BASIC_AUTH_PASSWORD;

    // Opt-in: without configured credentials we don't enforce authorization.
    if (!user || !pass) return next();

    // The health check must be reachable without logging in (hosting monitoring).
    if (req.path === "/api/health") return next();

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
