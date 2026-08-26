import { useCallback } from "react";
import { READ_TAG } from "../utils/bookshelf";

/**
 * Writing the „read" state to Notion: `mark-as-read` adds the „Przeczytane" tag
 * in the „Źródło" column, `unmark-as-read` removes it. Throws on error — the caller
 * (shelf) makes an optimistic move and reverts it if the write fails.
 */
export function useMarkRead() {
  const setRead = useCallback(async (pageId: string, read: boolean): Promise<void> => {
    const url = read ? "/api/mark-as-read" : "/api/unmark-as-read";
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ pageId, tag: READ_TAG }),
    });
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      throw new Error(body.error || "Zapis do Notion nie powiódł się");
    }
  }, []);

  return { setRead };
}
