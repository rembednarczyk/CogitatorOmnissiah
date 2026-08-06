import express from "express";
import path from "path";
import { NotionAdapter } from "./notion.adapter";
import { WikiAdapter } from "./wiki.adapter";
import dotenv from "dotenv";
import { BookSyncService } from "./services/bookSyncService";
import { DuplicateSyncService } from "./services/duplicateSyncService";
import { PublisherSyncService } from "./services/publisherSyncService";
import { SeriesSyncService } from "./services/seriesSyncService";
import { CyclesSyncService } from "./services/cyclesSyncService";
import { LpSyncService } from "./services/lpSyncService";
import { StatsService } from "./services/statsService";
import { PurificationService } from "./services/purificationService";
import { SchemaValidationService } from "./services/schemaValidationService";
import { IntegrityService } from "./services/integrityService";
import { LibraryCheckService } from "./services/libraryCheckService";
import { VintedSyncService } from "./services/vintedSyncService";
import syncRoutes from "./routes/syncRoutes";
import { createLogger, classifyHttpError } from "./logger";
import { SyncEvent } from "./src/types";
import { basicAuth } from "./middleware/basicAuth";

dotenv.config();

const serverLog = createLogger("Server");

const notionAdapter = new NotionAdapter(process.env.NOTION_API_KEY!, process.env.NOTION_DATABASE_ID!);
const wikiAdapter = new WikiAdapter();
const duplicateSyncService = new DuplicateSyncService(notionAdapter, wikiAdapter);
const bookSyncService = new BookSyncService(notionAdapter, wikiAdapter);
const publisherSyncService = new PublisherSyncService(notionAdapter, wikiAdapter);
const seriesSyncService = new SeriesSyncService(notionAdapter, wikiAdapter);
const cyclesSyncService = new CyclesSyncService(notionAdapter, wikiAdapter);
const lpSyncService = new LpSyncService(notionAdapter);
const statsService = new StatsService(notionAdapter);
const purificationService = new PurificationService(notionAdapter);
const schemaValidationService = new SchemaValidationService(notionAdapter);
const integrityService = new IntegrityService(notionAdapter, wikiAdapter);
const libraryCheckService = new LibraryCheckService(notionAdapter);
const vintedSyncService = new VintedSyncService(notionAdapter);

interface SyncTask {
  name: string;
  cancelRequested: boolean;
}

class SyncManager {
  private currentTask: SyncTask | null = null;

  constructor(private notion: NotionAdapter, private wiki: WikiAdapter) {}

  get activeTask() {
    return this.currentTask?.name ?? null;
  }

  get isSyncing() {
    return this.currentTask !== null;
  }

  async getStats() {
    return await statsService.getStats();
  }

  async getNotionSchema() {
    return await this.notion.getSchema();
  }

  async updateNotionSchema(propertyName: string, propertyType: string, newOptions: any) {
    return await this.notion.updateSchema(propertyName, propertyType, newOptions);
  }

  private async executeTask(taskName: string, taskFn: (checkCancellation: () => boolean) => Promise<void>) {
    if (this.isSyncing) throw new Error(`Inna synchronizacja (${this.activeTask}) jest już w toku.`);
    const task: SyncTask = { name: taskName, cancelRequested: false };
    this.currentTask = task;
    try {
      await taskFn(() => task.cancelRequested);
    } finally {
      // Zwolnij blokadę tylko jeśli nadal należy do tego zadania —
      // po resetSyncState() mogło już wystartować nowe zadanie
      if (this.currentTask === task) {
        this.currentTask = null;
      }
    }
  }

  async runBookSync(params: { awardName?: string; pageTitle?: string; syncAll?: boolean }, sendEvent: (data: SyncEvent) => void) {
    await this.executeTask('book', (checkCancellation) => bookSyncService.runBookSync(params, sendEvent, checkCancellation));
  }

  async runPurifySync(sendEvent: (data: SyncEvent) => void) {
    await this.executeTask('purify', (checkCancellation) => purificationService.runPurification(sendEvent, checkCancellation));
  }

  async runSchemaSync(sendEvent: (data: SyncEvent) => void) {
    await this.executeTask('schema', (checkCancellation) => schemaValidationService.runSchemaValidation(sendEvent, checkCancellation));
  }

  async runPublisherSync(sendEvent: (data: SyncEvent) => void) {
    await this.executeTask('publisher', (checkCancellation) => publisherSyncService.runPublisherSync(sendEvent, checkCancellation));
  }

  async runSeriesSync(sendEvent: (data: SyncEvent) => void) {
    await this.executeTask('series', (checkCancellation) => seriesSyncService.runSeriesSync(sendEvent, checkCancellation));
  }

  async runDuplicateCheck(sendEvent: (data: SyncEvent) => void) {
    await this.executeTask('duplicates', (checkCancellation) => duplicateSyncService.runDuplicateCheck(sendEvent, checkCancellation));
  }

  async runLpSync(sendEvent: (data: SyncEvent) => void) {
    await this.executeTask('lp', (checkCancellation) => lpSyncService.runLpSync(sendEvent, checkCancellation));
  }

  async runCyclesSync(sendEvent: (data: SyncEvent) => void) {
    await this.executeTask('cycles', (checkCancellation) => cyclesSyncService.runCyclesSync(sendEvent, checkCancellation));
  }

  async runIntegrityCheck(sendEvent: (data: SyncEvent) => void) {
    await this.executeTask('integrity', (checkCancellation) => integrityService.runIntegrityCheck(sendEvent, checkCancellation));
  }

  async getWikiLastUpdate(pageTitle: string) {
    return await this.wiki.fetchLastRevisionDate(pageTitle);
  }

  async markAsRead(pageId: string) {
    return await this.notion.addTagToMultiSelect(pageId, "Źródło", "Przeczytane");
  }

  async checkLibraryAvailability(libraryCode: string, sendEvent: (data: SyncEvent) => void) {
    await this.executeTask('library', (checkCancellation) => libraryCheckService.runLibraryCheck(libraryCode, sendEvent, checkCancellation));
  }

  async checkVintedAvailability(sendEvent: (data: SyncEvent) => void) {
    await this.executeTask('vinted', (checkCancellation) => vintedSyncService.runVintedCheck(sendEvent, checkCancellation));
  }

  /**
   * Diagnostyka end-to-end: sprawdza połączenie z Notion oraz pobranie i
   * parsowanie każdej strony nagrody z encyklopedii. Zwraca strukturę JSON,
   * którą można otworzyć w przeglądarce (GET /api/diagnostics) — jedno miejsce,
   * by zobaczyć, DLACZEGO sync nie działa (blokada IP, brak strony, 0 książek).
   */
  async runDiagnostics() {
    const startedAt = Date.now();
    const report: any = {
      env: {
        hasNotionKey: !!process.env.NOTION_API_KEY,
        hasDatabaseId: !!process.env.NOTION_DATABASE_ID,
        nodeEnv: process.env.NODE_ENV || "(unset)",
      },
      notion: { ok: false } as any,
      wiki: [] as any[],
      summary: "",
    };

    // 1. Notion — inicjalizacja i lekki odczyt schematu
    try {
      await this.notion.init();
      const schema = await this.notion.getSchema();
      report.notion = { ok: true, propertyCount: schema ? Object.keys(schema).length : 0 };
      serverLog.info("Diagnostics: Notion OK", report.notion);
    } catch (err: any) {
      report.notion = { ok: false, error: err?.message, code: err?.code };
      serverLog.error("Diagnostics: Notion FAILED", report.notion);
    }

    // 2. Wiki — pobranie każdej strony nagrody z osobna
    const AWARDS = [
      { name: "Nagroda Hugo", title: "Hugo nagroda powieść" },
      { name: "Nagroda Nebula", title: "Nebula nagroda najlepsza powieść" },
      { name: "Nagroda Locus", title: "Locus nagroda powieść" },
    ];
    for (const aw of AWARDS) {
      const t0 = Date.now();
      try {
        const books = await bookSyncService.fetchBooksFromMediaWiki(aw.title, aw.name, () => {});
        const entry = {
          award: aw.name, pageTitle: aw.title, ok: true,
          booksParsed: books.length, ms: Date.now() - t0,
          note: books.length === 0 ? "Pobrano stronę, ale sparsowano 0 książek — sprawdź tytuł strony lub układ tabeli." : undefined,
        };
        report.wiki.push(entry);
        serverLog.info("Diagnostics: wiki page OK", entry);
      } catch (err: any) {
        const info = classifyHttpError(err);
        const entry = {
          award: aw.name, pageTitle: aw.title, ok: false,
          classification: err?.classification || info.class,
          status: err?.status || info.status,
          hint: err?.userHint || info.hint,
          error: err?.message, ms: Date.now() - t0,
        };
        report.wiki.push(entry);
        serverLog.error("Diagnostics: wiki page FAILED", entry);
      }
    }

    // 3. Podsumowanie diagnozy
    const wikiOk = report.wiki.filter((w: any) => w.ok);
    const wikiBlocked = report.wiki.filter((w: any) => w.classification === "ip_blocked");
    if (!report.notion.ok) {
      report.summary = "Notion nie odpowiada — sprawdź NOTION_API_KEY / NOTION_DATABASE_ID i dostęp integracji.";
    } else if (wikiBlocked.length > 0) {
      report.summary = "Encyklopedia blokuje żądania serwera (403/Cloudflare). To najczęstsza przyczyna niedziałających synchronizacji na hostingu — IP serwera jest zablokowane. Uruchom lokalnie lub użyj proxy o zaufanym IP.";
    } else if (wikiOk.length > 0 && wikiOk.every((w: any) => w.booksParsed === 0)) {
      report.summary = "Strony pobrane, ale sparsowano 0 książek — prawdopodobnie zmienił się tytuł strony w encyklopedii albo układ tabeli.";
    } else if (wikiOk.length === report.wiki.length) {
      report.summary = "Wszystko działa: Notion i encyklopedia odpowiadają, książki są parsowane. Jeśli sync nadal nie działa, sprawdź logi konkretnego rytuału.";
    } else {
      report.summary = "Częściowa awaria pobierania z encyklopedii — szczegóły w polu 'wiki'.";
    }
    report.ms = Date.now() - startedAt;
    return report;
  }

  stopActiveSync() {
    if (this.currentTask) {
      this.currentTask.cancelRequested = true;
      return true;
    }
    return false;
  }

  resetSyncState() {
    // Nie zostawiaj osieroconego zadania piszącego do Notion — najpierw anuluj,
    // potem zwolnij blokadę. Zadanie zachowuje własny obiekt stanu, więc jego
    // finally nie wyczyści stanu nowego zadania (porównanie tożsamości w executeTask).
    if (this.currentTask) {
      this.currentTask.cancelRequested = true;
      this.currentTask = null;
    }
  }
}

export const syncManager = new SyncManager(notionAdapter, wikiAdapter);

export const app = express();
// Opt-in Basic Auth (aktywne tylko gdy ustawiono BASIC_AUTH_USER + _PASSWORD).
// Musi być pierwszy, by chronić także SPA i pliki statyczne.
app.use(basicAuth());
app.use(express.json());
app.use("/api", syncRoutes);

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
