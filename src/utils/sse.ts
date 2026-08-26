import { SyncEvent } from "../types";

/**
 * Shared SSE stream reader for all hooks (useSync, useLibraryCheck,
 * useVintedCheck). Buffers fragments between TCP reads — a single SSE event
 * is sometimes cut at a chunk boundary, and `JSON.parse` on a half crashes the scan.
 * Splits on `\n\n`, keeps the remainder, parses `data: ` lines and calls `onEvent`.
 *
 * `onEvent` may return `true` (or `"stop"`) to end consumption early
 * (e.g. after a `complete`/`error` event). `onChunk` fires after every read —
 * useSync uses it to reset the watchdog (keepalive also counts as activity).
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
    // When we exit early (stop on complete/error or a throw from onEvent),
    // the fetch stream would be left locked and uncancelled. Cancel the reader to
    // free the connection — except on the natural end (done).
    if (!finished) {
      try { await reader.cancel(); } catch { /* the reader may not support cancel */ }
    }
  }
}
