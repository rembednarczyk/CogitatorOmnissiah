/**
 * `fetch` with a hard timeout — a barcode scan (and the fresh-index refetch it
 * triggers) must never wedge the UI on a stalled connection. On timeout the
 * request is aborted and the promise rejects (caller decides the fallback).
 */
export async function fetchWithTimeout(url: string, ms = 12000): Promise<Response> {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), ms);
  try {
    return await fetch(url, { signal: ctrl.signal });
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Add/remove a „Źródło" tag on a Notion row: `active` → `mark-as-read`, else
 * `unmark-as-read`. The single write transport shared by the shelf, stats and
 * cycle-harvest hooks; each layers its own optimistic/lock state on top. Throws
 * on a non-OK response (server error message, or `errorFallback`).
 */
export async function markReadRequest(pageId: string, tag: string | undefined, active: boolean, errorFallback = "Zapis do Notion nie powiódł się"): Promise<void> {
  const url = active ? "/api/mark-as-read" : "/api/unmark-as-read";
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ pageId, tag }),
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.error || errorFallback);
  }
}

/** Fire-and-forget POST to a task's `/stop` endpoint (best-effort; a failure is only logged). */
export async function postStop(url: string): Promise<void> {
  try {
    await fetch(url, { method: "POST" });
  } catch (err) {
    console.error("Stop request failed:", err);
  }
}
