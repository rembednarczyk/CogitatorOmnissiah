import { useCallback } from "react";
import { READ_TAG } from "../utils/bookshelf";

/**
 * Zapis stanu „przeczytane" do Notion: `mark-as-read` dodaje tag „Przeczytane"
 * w kolumnie „Źródło", `unmark-as-read` go usuwa. Rzuca przy błędzie — wołający
 * (regał) robi optymistyczny ruch i cofa go, jeśli zapis się nie powiedzie.
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
