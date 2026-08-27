import { useCallback } from "react";
import { READ_TAG } from "../utils/bookshelf";
import { markReadRequest } from "../utils/http";

/**
 * Writing the „read" state to Notion: `mark-as-read` adds the „Przeczytane" tag
 * in the „Źródło" column, `unmark-as-read` removes it. Throws on error — the caller
 * (shelf) makes an optimistic move and reverts it if the write fails.
 */
export function useMarkRead() {
  const setRead = useCallback((pageId: string, read: boolean): Promise<void> =>
    markReadRequest(pageId, READ_TAG, read), []);

  return { setRead };
}
