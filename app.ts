import express from "express";
import syncRoutes from "./routes/syncRoutes";
import { basicAuth } from "./middleware/basicAuth";

/**
 * Wiring aplikacji Express (bez nasłuchu). Statyka/Vite i `listen` żyją w
 * `server.ts` (entrypoint), bo są zależne od środowiska; tutaj jest tylko
 * czysty łańcuch middleware + trasy API, łatwy do zamontowania w testach.
 */
export const app = express();

// Opt-in Basic Auth (aktywne tylko gdy ustawiono BASIC_AUTH_USER + _PASSWORD).
// Musi być pierwszy, by chronić także SPA i pliki statyczne.
app.use(basicAuth());
app.use(express.json());
app.use("/api", syncRoutes);
