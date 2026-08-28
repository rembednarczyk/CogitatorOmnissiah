import express from "express";
import syncRoutes from "./routes/syncRoutes";
import { basicAuth } from "./middleware/basicAuth";
import { sameOrigin } from "./middleware/sameOrigin";

/**
 * Express app wiring (no listening). Static/Vite and `listen` live in
 * `server.ts` (entrypoint), because they're environment-dependent; here there's
 * only the pure middleware chain + API routes, easy to mount in tests.
 */
export const app = express();

// Opt-in Basic Auth (active only when BASIC_AUTH_USER + _PASSWORD are set).
// Must come first, to protect the SPA and static files too.
app.use(basicAuth());
// CSRF: reject state-changing requests that state a foreign origin. Mounted before the
// routes (and before the body parser — nothing needs parsing to make this decision).
app.use(sameOrigin());
app.use(express.json());
app.use("/api", syncRoutes);
