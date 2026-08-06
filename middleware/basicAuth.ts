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
 * Aktywne tylko gdy ustawiono OBIE zmienne BASIC_AUTH_USER i
 * BASIC_AUTH_PASSWORD — w przeciwnym razie middleware przepuszcza wszystko
 * (zachowanie domyślne, brak lockoutu istniejącego wdrożenia).
 * `/api/health` jest zawsze otwarte (health check hostingu).
 *
 * Chroni cały serwis (SPA + API): przeglądarka pokazuje natywny prompt, a
 * same-origin `fetch` z SPA automatycznie dołącza poświadczenia po zalogowaniu.
 */
export function basicAuth(getEnv: () => NodeJS.ProcessEnv = () => process.env) {
  return (req: Request, res: Response, next: NextFunction) => {
    const env = getEnv();
    const user = env.BASIC_AUTH_USER;
    const pass = env.BASIC_AUTH_PASSWORD;

    // Opt-in: bez skonfigurowanych poświadczeń nie wymuszamy autoryzacji.
    if (!user || !pass) return next();

    // Health check musi być osiągalny bez logowania (monitoring hostingu).
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
