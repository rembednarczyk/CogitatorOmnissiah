import { Request, Response } from "express";
import { syncManager, SyncTaskName } from "../syncManager";
import { SyncEvent, SyncParams } from "../src/types";
import { createLogger } from "../logger";

const log = createLogger("SyncController");

export const getStats = async (req: Request, res: Response) => {
  try {
    const stats = await syncManager.getStats();
    res.json(stats);
  } catch (error: any) {
    console.error("Stats Error:", error);
    res.status(500).json({ error: error.message || "Wystąpił błąd podczas pobierania statystyk." });
  }
};

export const getWikiLastUpdate = async (req: Request, res: Response) => {
  try {
    const { title } = req.query;
    if (!title) return res.status(400).json({ error: "Missing title parameter" });
    const lastUpdate = await syncManager.getWikiLastUpdate(title as string);
    res.json({ lastUpdate });
  } catch (error: any) {
    console.error("Wiki Last Update Error:", error);
    res.status(500).json({ error: error.message || "Wystąpił błąd podczas pobierania daty aktualizacji." });
  }
};

export const getDiagnostics = async (req: Request, res: Response) => {
  try {
    const report = await syncManager.runDiagnostics();
    // Zwróć 200 zawsze — raport sam opisuje status; ułatwia odczyt w przeglądarce.
    res.json(report);
  } catch (error: any) {
    log.error("Diagnostics endpoint failed", { message: error?.message });
    res.status(500).json({ error: error?.message || "Diagnostyka nie powiodła się." });
  }
};

export const getHealth = (req: Request, res: Response) => {
  res.json({ 
    status: "ok",
    isSyncing: syncManager.isSyncing
  });
};

export const getConfig = (req: Request, res: Response) => {
  res.json({
    hasNotionKey: !!process.env.NOTION_API_KEY,
    hasDatabaseId: !!process.env.NOTION_DATABASE_ID,
  });
};

export const getNotionSchema = async (req: Request, res: Response) => {
  try {
    const properties = await syncManager.getNotionSchema();
    if (!properties || Object.keys(properties).length === 0) {
      return res.json({ _empty: { type: "Baza danych nie ma żadnych kolumn (właściwości) lub jest całkowicie pusta." } });
    }
    res.json(properties);
  } catch (error: any) {
    console.error("Notion API Error:", error);
    res.status(500).json({ error: error.message || "Wystąpił błąd podczas pobierania schematu." });
  }
};

// Ten endpoint edytuje wyłącznie opcje kolumn select/multi_select — waliduj
// wejście zanim trafi do Notion (mutacja schematu jest operacją uprzywilejowaną).
const ALLOWED_SCHEMA_TYPES = new Set(["select", "multi_select"]);

export const updateNotionSchema = async (req: Request, res: Response) => {
  try {
    const { propertyName, propertyType, newOptions } = req.body ?? {};

    if (typeof propertyName !== "string" || propertyName.trim() === "" || propertyName.length > 200) {
      return res.status(400).json({ error: "Nieprawidłowa nazwa właściwości." });
    }
    if (!ALLOWED_SCHEMA_TYPES.has(propertyType)) {
      return res.status(400).json({ error: `Niedozwolony typ właściwości: ${propertyType}. Dozwolone: select, multi_select.` });
    }
    if (!Array.isArray(newOptions) || newOptions.length > 500 ||
        !newOptions.every(o => o && typeof o === "object" && typeof o.name === "string")) {
      return res.status(400).json({ error: "Nieprawidłowa lista opcji (oczekiwano tablicy { name })." });
    }

    await syncManager.updateNotionSchema(propertyName, propertyType, newOptions);
    res.json({ success: true });
  } catch (error: any) {
    log.error("Schema Update Error", { message: error?.message });
    res.status(500).json({ error: error.message || "Wystąpił błąd podczas aktualizacji schematu." });
  }
};

export const resetSyncState = (req: Request, res: Response) => {
  syncManager.resetSyncState();
  res.json({ success: true, message: "Stan synchronizacji został zresetowany." });
};

const stopSyncTask = (res: Response, message: string) => {
  if (syncManager.stopActiveSync()) {
    res.json({ success: true, message });
  } else {
    res.json({ success: false, message: "Brak trwającej synchronizacji." });
  }
};

// Zatrzymanie jest globalne (anuluje aktywne zadanie, jakiekolwiek by nie było) —
// handlery różnią się wyłącznie komunikatem. Generujemy je z fabryki.
const makeStopHandler = (message: string) =>
  (_req: Request, res: Response) => stopSyncTask(res, message);

export const stopSync = makeStopHandler("Zatrzymywanie synchronizacji...");
export const stopPublisherSync = makeStopHandler("Zatrzymywanie synchronizacji wydawnictw...");
export const stopSeriesSync = makeStopHandler("Zatrzymywanie synchronizacji serii...");
export const stopCyclesSync = makeStopHandler("Zatrzymywanie synchronizacji cykli...");
export const stopLpSync = makeStopHandler("Zatrzymywanie aktualizacji Lp...");
export const stopDuplicatesSync = makeStopHandler("Zatrzymywanie sprawdzania duplikatów...");
export const stopLibraryCheck = makeStopHandler("Zatrzymywanie skanowania biblioteki...");
export const stopIntegrityCheck = makeStopHandler("Zatrzymano skanowanie integralności.");

const setupSSE = (res: Response) => {
  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache, no-transform");
  res.setHeader("Connection", "keep-alive");
  // Wyłącz buforowanie po stronie proxy (nginx/Render) — bez tego zdarzenia SSE
  // nie docierają do klienta na bieżąco i UI "nie reaguje" na hostingu.
  res.setHeader("X-Accel-Buffering", "no");
  // Wyślij nagłówki natychmiast, żeby połączenie było otwarte zanim ruszy zadanie.
  res.flushHeaders?.();
  // Padding ~2KB komentarza: niektóre proxy (Render) buforują odpowiedź do progu
  // kilku KB zanim zaczną strumieniować — to wypycha bufor i wymusza flush,
  // dzięki czemu klient dostaje zdarzenia na bieżąco (a nie dopiero na końcu).
  res.write(`:${" ".repeat(2048)}\n\n`);
  return (data: SyncEvent) => {
    if (!res.writableEnded) res.write(`data: ${JSON.stringify(data)}\n\n`);
  };
};

export const runSync = async (req: Request, res: Response) => {
  const { awardName, pageTitle, syncAll } = req.body as SyncParams;
  
  if (!process.env.NOTION_API_KEY || !process.env.NOTION_DATABASE_ID) {
    return res.status(400).json({ error: "Brak kluczy API Notion." });
  }

  await executeSyncTask(
    req,
    res,
    (sendEvent) => syncManager.run("book", sendEvent, { awardName, pageTitle, syncAll }),
    "Sync Error:"
  );
};

const executeSyncTask = async (
  req: Request,
  res: Response,
  task: (sendEvent: (data: SyncEvent) => void) => Promise<void>,
  errorMessage: string
) => {
  if (syncManager.isSyncing) return res.status(400).json({ error: "Inna synchronizacja jest już w toku." });

  const sendEvent = setupSSE(res);
  // Natychmiastowy sygnał, że połączenie żyje — użytkownik widzi reakcję od razu,
  // nawet jeśli pierwszy krok zadania (pobranie z wiki) trwa kilka sekund.
  sendEvent({ type: "status", message: "Połączono z serwerem. Inicjacja rytuału..." });
  log.info("Sync task started", { endpoint: req.path });

  // Częstszy keepalive (5s) utrzymuje strumień "gorący" u proxy, które inaczej
  // zbierają dane w bufor między rzadkimi zapisami długiego zadania.
  const keepAlive = setInterval(() => {
    if (!res.writableEnded) res.write(": keepalive\n\n");
  }, 5000);

  // Rozłączenie klienta (zamknięta karta, utrata sieci) — anuluj zadanie,
  // żeby osierocony sync nie blokował kolejnych rytuałów godzinami.
  // UWAGA: nasłuchujemy na res, nie req. Dla POST z ciałem req emituje "close"
  // po skonsumowaniu ciała przez express.json() — nie przy rozłączeniu klienta —
  // co anulowało aktywny sync tuż po starcie. res "close" odpala się dopiero gdy
  // odpowiedź faktycznie się zamyka; przy normalnym końcu writableEnded==true,
  // więc guard poniżej nie anuluje niczego przez pomyłkę.
  res.on("close", () => {
    if (!res.writableEnded) {
      clearInterval(keepAlive);
      log.warn("Klient rozłączył się w trakcie synchronizacji — przerywam zadanie.", { endpoint: req.path });
      syncManager.stopActiveSync();
    }
  });

  try {
    await task(sendEvent);
    clearInterval(keepAlive);
    log.info("Sync task finished", { endpoint: req.path });
    res.end();
  } catch (error: any) {
    clearInterval(keepAlive);
    log.error(`${errorMessage} ${error?.message || ""}`, {
      endpoint: req.path,
      name: error?.name,
      classification: error?.classification,
      status: error?.status,
      stack: error?.stack?.split("\n").slice(0, 4).join(" | "),
    });
    // WikiFetchError niesie userHint z konkretną wskazówką — pokaż ją użytkownikowi.
    const userMessage = error?.userHint
      ? `${error.message}`
      : error?.message || errorMessage;
    sendEvent({ type: "error", error: userMessage });
    res.end();
  }
};

// Rytuały bez parametrów żądania mają identyczny handler — różnią się tylko
// nazwą zadania i etykietą błędu. Generujemy je z tabeli zamiast powielać.
const makeSyncHandler = (task: SyncTaskName, errorLabel: string) =>
  async (req: Request, res: Response) => {
    await executeSyncTask(req, res, (sendEvent) => syncManager.run(task, sendEvent), errorLabel);
  };

export const runPublisherSync = makeSyncHandler("publisher", "Sync Publisher Error:");
export const runSeriesSync = makeSyncHandler("series", "Sync Series Error:");
export const runCyclesSync = makeSyncHandler("cycles", "Sync Cycles Error:");
export const runLpSync = makeSyncHandler("lp", "Sync Lp Error:");
export const runDuplicateCheck = makeSyncHandler("duplicates", "Sync Duplicates Error:");
export const runPurifySync = makeSyncHandler("purify", "Sync Purify Error:");
export const runSchemaSync = makeSyncHandler("schema", "Sync Schema Error:");
export const runIntegrityCheck = makeSyncHandler("integrity", "Integrity Check Error:");

export const stopPurifySync = makeStopHandler("Zatrzymano rytuał puryfikacji.");

export const stopSchemaSync = makeStopHandler("Zatrzymano inicjalizację schematu.");

export const markAsRead = async (req: Request, res: Response) => {
  try {
    const { pageId } = req.body;
    if (!pageId) return res.status(400).json({ error: "Missing pageId parameter" });
    await syncManager.markAsRead(pageId);
    res.json({ success: true });
  } catch (error: any) {
    console.error("Mark as Read Error:", error);
    res.status(500).json({ error: error.message || "Wystąpił błąd podczas oznaczania jako przeczytane." });
  }
};

export const checkVintedAvailability = async (req: Request, res: Response) => {
  if (!process.env.NOTION_API_KEY || !process.env.NOTION_DATABASE_ID) {
    return res.status(400).json({ error: "Brak kluczy API Notion." });
  }

  await executeSyncTask(
    req,
    res,
    (sendEvent) => syncManager.run("vinted", sendEvent),
    "Vinted Check Error:"
  );
};

export const stopVintedCheck = makeStopHandler("Zatrzymywanie skanowania Vinted...");

export const checkLibraryAvailability = async (req: Request, res: Response) => {
  const { libraryCode } = req.body;
  if (!libraryCode) return res.status(400).json({ error: "Missing libraryCode parameter" });

  await executeSyncTask(
    req,
    res,
    (sendEvent) => syncManager.run("library", sendEvent, { libraryCode }),
    "Library Check Error:"
  );
};
