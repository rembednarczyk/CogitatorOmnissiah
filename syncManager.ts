import { NotionAdapter } from "./notion.adapter";
import { WikiAdapter } from "./wiki.adapter";
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
import { CycleLookupService } from "./services/cycleLookupService";
import { CycleHarvestService } from "./services/cycleHarvestService";
import { mergeCycleCaches } from "./services/cycleHarvest";
import { toSearchIndex } from "./services/bookSearchIndex";
import { ConfigService } from "./services/configService";
import { createLogger, classifyHttpError } from "./logger";
import { SyncEvent } from "./src/types";

/**
 * Composition root domeny: buduje adaptery, serwisy i orkiestrator SyncManager.
 * Trzymane z dala od `server.ts` (który jest tylko entrypointem HTTP) — dzięki
 * temu kontrolery importują `syncManager` stąd, a nie z modułu serwera, co
 * kasuje cykl server → routes → controller → server.
 */

const log = createLogger("SyncManager");

const notionAdapter = new NotionAdapter(process.env.NOTION_API_KEY!, process.env.NOTION_DATABASE_ID!);
const wikiAdapter = new WikiAdapter();
/** Konfiguracja aplikacji (knoby) — defaulty + nadpisania z Notion; wstrzykiwana do serwisów. */
export const configService = new ConfigService(notionAdapter);
const duplicateSyncService = new DuplicateSyncService(notionAdapter, wikiAdapter, configService);
const bookSyncService = new BookSyncService(notionAdapter, wikiAdapter, configService);
const publisherSyncService = new PublisherSyncService(notionAdapter, wikiAdapter);
const seriesSyncService = new SeriesSyncService(notionAdapter, wikiAdapter);
const cyclesSyncService = new CyclesSyncService(notionAdapter, wikiAdapter, configService);
const lpSyncService = new LpSyncService(notionAdapter);
const statsService = new StatsService(notionAdapter, configService);
const purificationService = new PurificationService(notionAdapter);
const schemaValidationService = new SchemaValidationService(notionAdapter);
const integrityService = new IntegrityService(notionAdapter, wikiAdapter, configService);
const libraryCheckService = new LibraryCheckService(notionAdapter, configService);
const vintedSyncService = new VintedSyncService(notionAdapter, configService);
const cycleLookupService = new CycleLookupService(notionAdapter, wikiAdapter);
const cycleHarvestService = new CycleHarvestService(notionAdapter, cycleLookupService, configService);

interface SyncTask {
  name: string;
  cancelRequested: boolean;
}

/** Kanoniczne nazwy rytuałów synchronizacji — jedno źródło prawdy dla dispatchu. */
export type SyncTaskName =
  | "book"
  | "purify"
  | "schema"
  | "publisher"
  | "series"
  | "duplicates"
  | "lp"
  | "cycles"
  | "cycles-harvest"
  | "integrity"
  | "library"
  | "vinted"
  | "vinted-resolve-sellers";

type TaskFn = (checkCancellation: () => boolean) => Promise<void>;

/**
 * Rejestr rytuałów: nazwa → fabryka `taskFn`. Każdy serwis ma inaczej nazwaną
 * metodę `run*`, ale wszystkie mają ten sam kontrakt `(sendEvent, checkCancellation)`;
 * rejestr spina je w jedną tablicę, dzięki czemu SyncManager.run() jest jednym
 * generycznym dispatcherem zamiast kilkunastu bliźniaczych metod. `book` i
 * `library` przyjmują dodatkowe parametry z żądania (przez argument `params`).
 */
const TASK_REGISTRY: Record<SyncTaskName, (sendEvent: (data: SyncEvent) => void, params?: any) => TaskFn> = {
  book:       (s, p) => (cc) => bookSyncService.runBookSync(p ?? {}, s, cc),
  purify:     (s) => (cc) => purificationService.runPurification(s, cc),
  schema:     (s) => (cc) => schemaValidationService.runSchemaValidation(s, cc),
  publisher:  (s) => (cc) => publisherSyncService.runPublisherSync(s, cc),
  series:     (s) => (cc) => seriesSyncService.runSeriesSync(s, cc),
  duplicates: (s) => (cc) => duplicateSyncService.runDuplicateCheck(s, cc),
  lp:         (s) => (cc) => lpSyncService.runLpSync(s, cc),
  cycles:     (s) => (cc) => cyclesSyncService.runCyclesSync(s, cc),
  "cycles-harvest": (s) => (cc) => cycleHarvestService.runCycleHarvest(s, cc),
  integrity:  (s) => (cc) => integrityService.runIntegrityCheck(s, cc),
  library:    (s, p) => (cc) => libraryCheckService.runLibraryCheck(p.libraryCode, s, cc),
  vinted:     (s, p) => (cc) => vintedSyncService.runVintedCheck(s, cc, p),
  "vinted-resolve-sellers": (s, p) => (cc) => vintedSyncService.resolveSellersToStore(s, cc, p),
};

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

  /** Odchudzony indeks książek dla wyszukiwarki „Skryptorium" (client-side). */
  async getBooks() {
    const books = await this.notion.getBooksForStats(undefined, undefined, { cache: true });
    return toSearchIndex(books);
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

  /**
   * Generyczny dispatch rytuału: pobiera fabrykę z rejestru, buduje `taskFn`
   * i uruchamia ją pod blokadą pojedynczego zadania. `params` niosą dane
   * z żądania dla rytuałów, które ich wymagają (`book`, `library`).
   */
  async run(taskName: SyncTaskName, sendEvent: (data: SyncEvent) => void, params?: any) {
    const makeTaskFn = TASK_REGISTRY[taskName];
    if (!makeTaskFn) throw new Error(`Nieznany rytuał synchronizacji: ${taskName}`);
    await this.executeTask(taskName, makeTaskFn(sendEvent, params));
  }

  async getWikiLastUpdate(pageTitle: string) {
    return await this.wiki.fetchLastRevisionDate(pageTitle);
  }

  // Dopisuje znacznik „Źródło" na stronie książki. Domyślnie „Przeczytane"
  // (przycisk w zasobach posiadanych / bibliotecznych statystykach), ale skaner
  // bibliotek podaje znacznik filii („Biblioteka" = Felin, „Biblioteka 9" =
  // Bronowice), aby oznaczyć, w której filii pozycja jest dostępna.
  async markAsRead(pageId: string, tag: string = "Przeczytane") {
    return await this.notion.addTagToMultiSelect(pageId, "Źródło", tag);
  }

  /** Usuwa znacznik „Źródło" (odwrotność `markAsRead`) — drag&drop na regale. */
  async unmarkRead(pageId: string, tag: string = "Przeczytane") {
    return await this.notion.removeTagFromMultiSelect(pageId, "Źródło", tag);
  }

  /** Zapis ręcznych kluczy porządku regału (precyzyjny drag&drop). */
  async setShelfOrders(entries: { pageId: string; order: number }[]) {
    return await this.notion.setShelfOrders(entries);
  }

  /** Odczyt składowanych wyników Vinted (kafelki/paczki z bazy — bez re-scrape). */
  async getVintedStored() {
    return await vintedSyncService.getStoredData();
  }

  /** Podgląd cyklu dla książki (na żądanie, bez zapisu do bazy). */
  /** Zagregowany widok zebranych cykli (z blobów `CycleCache`) dla Archiwum. */
  async getCyclesHarvest() {
    const books = await this.notion.getBooksForStats(undefined, undefined, { cache: true });
    return mergeCycleCaches(books);
  }

  async getCycle(title: string, author: string) {
    return await cycleLookupService.lookup(title, author);
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
      log.info("Diagnostics: Notion OK", report.notion);
    } catch (err: any) {
      report.notion = { ok: false, error: err?.message, code: err?.code };
      log.error("Diagnostics: Notion FAILED", report.notion);
    }

    // 2. Wiki — pobranie każdej strony nagrody z osobna (lista z konfiguracji `sync.awards`)
    const AWARDS = (await configService.getConfig()).sync.awards;
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
        log.info("Diagnostics: wiki page OK", entry);
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
        log.error("Diagnostics: wiki page FAILED", entry);
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
    // Anuluj aktywne zadanie, ale NIE zeruj blokady natychmiast. Wcześniej
    // resetSyncState od razu ustawiał currentTask = null, przez co isSyncing
    // stawał się false i kolejny POST /sync-* startował drugie zadanie, gdy
    // osierocone wciąż pisało do Notion (łamiąc "dokładnie jeden sync naraz").
    // Zamiast tego sygnalizujemy anulowanie; blokada zwolni się w `finally`
    // zadania (identity-check), gdy zauważy cancelRequested i wyjdzie — a że
    // wszystkie rytuały sprawdzają checkCancellation w pętlach i mają ograniczone
    // timeouty (axios/withRetry), następuje to szybko i bez okna równoległych zapisów.
    this.stopActiveSync();
  }
}

export const syncManager = new SyncManager(notionAdapter, wikiAdapter);
