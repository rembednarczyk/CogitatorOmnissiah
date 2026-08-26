import express from "express";
import path from "path";
import dotenv from "dotenv";
import { createLogger } from "./logger";
import { app } from "./app";

dotenv.config();

const serverLog = createLogger("Server");

// Re-export for backward compatibility — controllers import `syncManager` from
// ./syncManager, but tests and other modules can still reach for { app, syncManager }
// via ./server.
export { app } from "./app";
export { syncManager } from "./syncManager";

const PORT = parseInt(process.env.PORT || "3000", 10);
let server: any;

export async function startServer() {
  // Vite middleware for development
  if (process.env.NODE_ENV !== "production" && !process.env.VITEST) {
    // Dynamic import keeps vite out of the production bundle
    const { createServer: createViteServer } = await import("vite");
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else if (process.env.NODE_ENV === "production") {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  server = app.listen(PORT, "0.0.0.0", () => {
    serverLog.info(`Server running on port ${PORT}`, {
      port: PORT,
      nodeEnv: process.env.NODE_ENV || "(unset)",
      hasNotionKey: !!process.env.NOTION_API_KEY,
      hasDatabaseId: !!process.env.NOTION_DATABASE_ID,
      diagnostics: "GET /api/diagnostics",
    });
    if (!process.env.NOTION_API_KEY || !process.env.NOTION_DATABASE_ID) {
      serverLog.warn("Brak NOTION_API_KEY lub NOTION_DATABASE_ID — synchronizacje z Notion nie zadziałają.");
    }
  });
}

process.on('unhandledRejection', (reason, promise) => {
  serverLog.error('Unhandled Rejection', { reason: (reason as any)?.message || String(reason) });
});

process.on('uncaughtException', (err) => {
  serverLog.error('Uncaught Exception', { message: err?.message, stack: err?.stack?.split("\n").slice(0, 4).join(" | ") });
});

if (process.env.NODE_ENV !== 'test' && !process.env.VITEST) {
  startServer();
}

export const closeServer = () => {
  if (server) {
    server.close();
  }
};
