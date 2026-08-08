import { Request, Response } from "express";
import { SyncEvent } from "../src/types";
import { syncManager } from "../syncManager";
import { createLogger } from "../logger";

const log = createLogger("SSE");

/**
 * Plumbing strumienia SSE dla długich rytuałów — nagłówki, hardening pod proxy,
 * keepalive, anulowanie przy rozłączeniu klienta. Wydzielone z kontrolera, który
 * powinien trzymać tylko parsowanie żądań i delegację; tu żyje transport.
 */

/** Ustaw nagłówki SSE + hardening pod buforujące proxy; zwróć funkcję `sendEvent`. */
export const setupSSE = (res: Response) => {
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
    // Po abort klienta socket bywa `destroyed` przy wciąż `writableEnded === false`
    // — sam guard writableEnded przepuszczał zapis do martwego socketu, co rzucało
    // nieobsłużony 'error' na strumieniu. Sprawdzaj też destroyed.
    if (!res.writableEnded && !res.destroyed) res.write(`data: ${JSON.stringify(data)}\n\n`);
  };
};

/**
 * Uruchom zadanie sync jako strumień SSE: guard pojedynczego rytuału, keepalive
 * co 5 s, anulowanie przy rozłączeniu klienta (na `res`, nie `req`) i mapowanie
 * błędu na zdarzenie `error`.
 */
export const executeSyncTask = async (
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
    if (!res.writableEnded && !res.destroyed) res.write(": keepalive\n\n");
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

  // Zapis do strumienia (sendEvent/keepalive) ma wyścig check-then-write: reset TCP między
  // guardem `!writableEnded` a `res.write` emituje 'error'. Bez listenera stałby się to
  // nieobsłużony uncaughtException. Połknij i zaloguj — `res.on('close')` i tak sprząta.
  res.on("error", (err: any) => {
    log.warn("Błąd strumienia SSE (klient prawdopodobnie się rozłączył).", { endpoint: req.path, error: err?.message });
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
