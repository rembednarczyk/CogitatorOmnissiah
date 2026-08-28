import express from "express";
import syncRoutes from "./routes/syncRoutes";
import { basicAuth } from "./middleware/basicAuth";
import { sameOrigin } from "./middleware/sameOrigin";
import { securityHeaders } from "./middleware/securityHeaders";

/**
 * Express app wiring (no listening). Static/Vite and `listen` live in
 * `server.ts` (entrypoint), because they're environment-dependent; here there's
 * only the pure middleware chain + API routes, easy to mount in tests.
 */
export const app = express();

// Don't advertise the stack.
app.disable("x-powered-by");

// Security response headers (CSP, nosniff, frame/referrer policy) — first, so they
// apply to every response including 401/403/503 and the static SPA.
app.use(securityHeaders());

// Basic Auth: opt-in in dev, fail-closed in production (see middleware/basicAuth.ts).
// Must come early, to protect the SPA and static files too.
app.use(basicAuth());
// CSRF: reject state-changing requests that state a foreign origin. Mounted before the
// routes (and before the body parser — nothing needs parsing to make this decision).
app.use(sameOrigin());
app.use(express.json());
app.use("/api", syncRoutes);
