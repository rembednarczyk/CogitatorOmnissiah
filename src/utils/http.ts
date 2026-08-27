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
