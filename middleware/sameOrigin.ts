import { Request, Response, NextFunction } from "express";

/**
 * CSRF defence for state-changing requests.
 *
 * WHY THIS IS NEEDED PRECISELY BECAUSE BASIC AUTH IS ON. Unlike a `SameSite` cookie,
 * HTTP Basic credentials are attached by the browser to CROSS-SITE requests to our
 * origin too. Several rituals take no body at all (`/api/sync-purify`, `/api/sync/stop`,
 * `/api/sync/reset`, …), so a page on any other site could auto-submit
 * `<form action="https://…/api/sync-purify" method="POST">` and the request would fire
 * with the owner's cached credentials. The response is unreadable cross-origin (we send
 * no CORS headers), but the SIDE EFFECT — a Notion-mutating run — still lands.
 *
 * THE POLICY. For POST/PUT/PATCH/DELETE:
 *   - `Origin` present  → its host must equal our own `Host`. Otherwise 403.
 *   - no `Origin`, `Referer` present → same check against the referer's host.
 *   - neither header    → allowed.
 *
 * That last branch is deliberate, not an oversight: browsers always send `Origin` on a
 * cross-origin POST (including form submissions), so its ABSENCE means the caller isn't
 * a browser — curl, the import script, a health probe. Rejecting those would break
 * legitimate CLI use without closing any browser-driven attack.
 *
 * Hosts are compared rather than full origins so that TLS termination at the hosting
 * proxy (http internally, https externally) doesn't produce false rejections.
 */
const MUTATING = new Set(["POST", "PUT", "PATCH", "DELETE"]);

/** Host (with port, when present) of an absolute URL; null when unparseable. */
function hostOf(value: string | undefined): string | null {
  if (!value || value === "null") return null; // `Origin: null` = opaque origin → not ours
  try {
    return new URL(value).host.toLowerCase();
  } catch {
    return null;
  }
}

export function sameOrigin() {
  return (req: Request, res: Response, next: NextFunction) => {
    if (!MUTATING.has(req.method)) return next();

    const self = (req.headers.host || "").toLowerCase();
    const origin = req.headers.origin;
    const referer = req.headers.referer;

    // A stated origin must match ours. `Origin: null` and unparseable values are
    // treated as "stated but not ours" → rejected, rather than falling through.
    if (origin !== undefined) {
      if (hostOf(origin) === self && self !== "") return next();
    } else if (referer !== undefined) {
      if (hostOf(referer) === self && self !== "") return next();
    } else {
      return next(); // no browser context — see the policy note above
    }

    return res.status(403).json({ error: "Żądanie odrzucone: niezgodne źródło (ochrona CSRF)." });
  };
}
