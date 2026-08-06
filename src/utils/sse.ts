import { SyncEvent } from "../types";

/**
 * Wspólny odczyt strumienia SSE dla wszystkich hooków (useSync, useLibraryCheck,
 * useVintedCheck). Buforuje fragmenty między odczytami TCP — pojedyncze zdarzenie
 * SSE bywa rozcięte na granicy chunku, a `JSON.parse` na połówce wywala skan.
 * Dzieli po `\n\n`, zachowuje resztę, parsuje linie `data: ` i woła `onEvent`.
 *
 * `onEvent` może zwrócić `true` (lub `"stop"`), by zakończyć konsumpcję wcześniej
 * (np. po zdarzeniu `complete`/`error`). `onChunk` odpala się po każdym odczycie —
 * useSync używa go do resetu watchdoga (keepalive też liczy się jako aktywność).
 */
export async function consumeSSE(
  body: ReadableStream<Uint8Array> | null | undefined,
  onEvent: (event: SyncEvent) => boolean | "stop" | void | Promise<boolean | "stop" | void>,
  onChunk?: () => void,
): Promise<void> {
  const reader = body?.getReader();
  if (!reader) return;

  const decoder = new TextDecoder();
  let buffer = "";
  let finished = false;

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) { finished = true; break; }
      onChunk?.();

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split("\n\n");
      buffer = lines.pop() || "";

      for (const line of lines) {
        if (!line.startsWith("data: ")) continue;
        let event: SyncEvent;
        try {
          event = JSON.parse(line.substring(6));
        } catch (e) {
          console.error("Błąd parsowania SSE:", e);
          continue;
        }
        const signal = await onEvent(event);
        if (signal === true || signal === "stop") return;
      }
    }
  } finally {
    // Gdy wychodzimy wcześniej (stop na complete/error albo rzut z onEvent),
    // strumień fetch zostałby zablokowany i nieanulowany. Anuluj czytnik, by
    // zwolnić połączenie — poza przypadkiem naturalnego końca (done).
    if (!finished) {
      try { await reader.cancel(); } catch { /* czytnik może nie wspierać cancel */ }
    }
  }
}
