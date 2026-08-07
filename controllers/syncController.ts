import { Request, Response } from "express";
import { syncManager, SyncTaskName } from "../syncManager";
import { SyncParams } from "../src/types";
import { createLogger } from "../logger";
import { executeSyncTask } from "./sseStream";

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

// Znaczniki „Źródło", które wolno dopisać z tego endpointu. Ograniczone do
// znanego zbioru — endpoint jedynie oznacza pozycję (przeczytana / dostępna w
// danej filii), nie może wstrzykiwać dowolnych tagów do bazy Notion.
const ALLOWED_SOURCE_TAGS = new Set(["Przeczytane", "Biblioteka", "Biblioteka 9"]);

export const markAsRead = async (req: Request, res: Response) => {
  try {
    const { pageId, tag } = req.body;
    if (!pageId) return res.status(400).json({ error: "Missing pageId parameter" });

    const sourceTag = tag ?? "Przeczytane";
    if (!ALLOWED_SOURCE_TAGS.has(sourceTag)) {
      return res.status(400).json({ error: `Niedozwolony znacznik: ${sourceTag}.` });
    }

    await syncManager.markAsRead(pageId, sourceTag);
    res.json({ success: true });
  } catch (error: any) {
    console.error("Mark as Read Error:", error);
    res.status(500).json({ error: error.message || "Wystąpił błąd podczas oznaczania pozycji." });
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
