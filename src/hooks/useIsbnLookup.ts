import { useCallback } from "react";
import { fetchWithTimeout } from "../utils/http";

/** Resolved book from `GET /api/isbn/:code` (variant A — ISBN → title). */
export interface IsbnLookupResult {
  title?: string;
  [k: string]: unknown;
}

/**
 * Resolves a barcode/ISBN to a book (title) server-side. Keeps the network I/O
 * out of the component: `SearchSection` only decides what to do with the result.
 * Returns `null` when the ISBN can't be resolved (non-OK response); network
 * failure / timeout rejects, so the caller can surface a miss message.
 */
export function useIsbnLookup() {
  const lookup = useCallback(async (code: string): Promise<IsbnLookupResult | null> => {
    const res = await fetchWithTimeout(`/api/isbn/${encodeURIComponent(code)}`);
    return res.ok ? await res.json() : null;
  }, []);

  return { lookup };
}
