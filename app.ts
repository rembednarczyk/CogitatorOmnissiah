import express from "express";
import syncRoutes from "./routes/syncRoutes";
import { basicAuth } from "./middleware/basicAuth";

/**
 * Express app wiring (no listening). Static/Vite and `listen` live in
 * `server.ts` (entrypoint), because they're environment-dependent; here there's
 * only the pure middleware chain + API routes, easy to mount in tests.
 */
export const app = express();

// Opt-in Basic Auth (active only when BASIC_AUTH_USER + _PASSWORD are set).
// Must come first, to protect the SPA and static files too.
app.use(basicAuth());
app.use(express.json());
app.use("/api", syncRoutes);
