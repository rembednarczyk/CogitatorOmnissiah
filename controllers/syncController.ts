import { Request, Response } from "express";
import { syncManager } from "../server";
import { SyncEvent, SyncParams } from "../src/types";

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

export const updateNotionSchema = async (req: Request, res: Response) => {
  try {
    const { propertyName, propertyType, newOptions } = req.body;
    await syncManager.updateNotionSchema(propertyName, propertyType, newOptions);
    res.json({ success: true });
  } catch (error: any) {
    console.error("Schema Update Error:", error);
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

export const stopSync = (req: Request, res: Response) => {
  stopSyncTask(res, "Zatrzymywanie synchronizacji...");
};

export const stopPublisherSync = (req: Request, res: Response) => {
  stopSyncTask(res, "Zatrzymywanie synchronizacji wydawnictw...");
};

export const stopSeriesSync = (req: Request, res: Response) => {
  stopSyncTask(res, "Zatrzymywanie synchronizacji serii...");
};

export const stopCyclesSync = (req: Request, res: Response) => {
  stopSyncTask(res, "Zatrzymywanie synchronizacji cykli...");
};

export const stopLpSync = (req: Request, res: Response) => {
  stopSyncTask(res, "Zatrzymywanie aktualizacji Lp...");
};

export const stopDuplicatesSync = (req: Request, res: Response) => {
  stopSyncTask(res, "Zatrzymywanie sprawdzania duplikatów...");
};

export const stopLibraryCheck = (req: Request, res: Response) => {
  stopSyncTask(res, "Zatrzymywanie skanowania biblioteki...");
};

export const stopIntegrityCheck = (req: Request, res: Response) => {
  stopSyncTask(res, "Zatrzymano skanowanie integralności.");
};

const setupSSE = (res: Response) => {
  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection", "keep-alive");
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
    (sendEvent) => syncManager.runBookSync({ awardName, pageTitle, syncAll }, sendEvent),
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
  const keepAlive = setInterval(() => {
    if (!res.writableEnded) res.write(": keepalive\n\n");
  }, 15000);

  // Rozłączenie klienta (zamknięta karta, utrata sieci) — anuluj zadanie,
  // żeby osierocony sync nie blokował kolejnych rytuałów godzinami
  req.on("close", () => {
    if (!res.writableEnded) {
      clearInterval(keepAlive);
      syncManager.stopActiveSync();
    }
  });

  try {
    await task(sendEvent);
    clearInterval(keepAlive);
    res.end();
  } catch (error: any) {
    clearInterval(keepAlive);
    console.error(errorMessage, error);
    sendEvent({ type: "error", error: error.message || errorMessage });
    res.end();
  }
};

export const runPublisherSync = async (req: Request, res: Response) => {
  await executeSyncTask(
    req,
    res,
    (sendEvent) => syncManager.runPublisherSync(sendEvent),
    "Sync Publisher Error:"
  );
};

export const runSeriesSync = async (req: Request, res: Response) => {
  await executeSyncTask(
    req,
    res,
    (sendEvent) => syncManager.runSeriesSync(sendEvent),
    "Sync Series Error:"
  );
};

export const runCyclesSync = async (req: Request, res: Response) => {
  await executeSyncTask(
    req,
    res,
    (sendEvent) => syncManager.runCyclesSync(sendEvent),
    "Sync Cycles Error:"
  );
};

export const runLpSync = async (req: Request, res: Response) => {
  await executeSyncTask(
    req,
    res,
    (sendEvent) => syncManager.runLpSync(sendEvent),
    "Sync Lp Error:"
  );
};

export const runDuplicateCheck = async (req: Request, res: Response) => {
  await executeSyncTask(
    req,
    res,
    (sendEvent) => syncManager.runDuplicateCheck(sendEvent),
    "Sync Duplicates Error:"
  );
};

export const runPurifySync = async (req: Request, res: Response) => {
  await executeSyncTask(
    req,
    res,
    (sendEvent) => syncManager.runPurifySync(sendEvent),
    "Sync Purify Error:"
  );
};

export const stopPurifySync = (req: Request, res: Response) => {
  stopSyncTask(res, "Zatrzymano rytuał puryfikacji.");
};

export const runSchemaSync = async (req: Request, res: Response) => {
  await executeSyncTask(
    req,
    res,
    (sendEvent) => syncManager.runSchemaSync(sendEvent),
    "Sync Schema Error:"
  );
};

export const runIntegrityCheck = async (req: Request, res: Response) => {
  await executeSyncTask(
    req,
    res,
    (sendEvent) => syncManager.runIntegrityCheck(sendEvent),
    "Integrity Check Error:"
  );
};

export const stopSchemaSync = (req: Request, res: Response) => {
  stopSyncTask(res, "Zatrzymano inicjalizację schematu.");
};

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
    (sendEvent) => syncManager.checkVintedAvailability(sendEvent),
    "Vinted Check Error:"
  );
};

export const stopVintedCheck = (req: Request, res: Response) => {
  stopSyncTask(res, "Zatrzymywanie skanowania Vinted...");
};

export const checkLibraryAvailability = async (req: Request, res: Response) => {
  const { libraryCode } = req.body;
  if (!libraryCode) return res.status(400).json({ error: "Missing libraryCode parameter" });

  await executeSyncTask(
    req,
    res,
    (sendEvent) => syncManager.checkLibraryAvailability(libraryCode, sendEvent),
    "Library Check Error:"
  );
};
