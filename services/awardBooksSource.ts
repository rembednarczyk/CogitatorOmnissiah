import { WikiAdapter } from "../wiki.adapter";
import { WikiParser } from "../wiki.parser";
import { Book, SyncEvent } from "../src/types";
import { createLogger } from "../logger";

const log = createLogger("AwardBooks");

/** One award page from the config (name = award label, title = wiki page title). */
export interface AwardPageRef {
  name: string;
  title: string;
}

/**
 * Fetch + parse a SINGLE award page (wiki → Book[]). Shared source for every
 * consumer of the wiki award lists (book sync, integrity check, diagnostics),
 * so the "which awards, fetched how" concern lives in one place instead of
 * being a method reached into on `BookSyncService`.
 *
 * "No data" vs "infra failure" is preserved: `fetchPageContent` returns "" for a
 * missing/renamed page (→ 0 books + a warning) but THROWS on a network failure,
 * which propagates to the caller.
 */
export async function fetchAwardPage(
  wiki: WikiAdapter,
  pageTitle: string,
  awardName: string,
  sendEvent: (data: SyncEvent) => void,
): Promise<Book[]> {
  sendEvent({ type: "status", message: `Inicjacja ekstrakcji danych z Archiwum Encyklopedii: ${awardName}...` });
  const wikitext = await wiki.fetchPageContent(pageTitle);

  if (!wikitext) {
    log.warn(`Pusta treść strony "${pageTitle}" — 0 książek dla ${awardName}`, { pageTitle, awardName });
  }

  sendEvent({ type: "status", message: `Dekodowanie tablic wyników: ${awardName}...` });
  const books = WikiParser.parseAwardTable(wikitext, awardName);
  log.info(`Sparsowano ${books.length} książek dla ${awardName}`, { awardName, pageTitle, wikitextLength: wikitext.length, books: books.length });
  return books;
}

/**
 * Fetch + parse a LIST of award pages, honoring cancellation between pages.
 * `awards` is the effective list from config (`sync.awards`) — the single source
 * of truth, so adding an award in Ustawienia is picked up everywhere.
 */
export async function fetchAwardBooks(
  wiki: WikiAdapter,
  awards: AwardPageRef[],
  sendEvent: (data: SyncEvent) => void,
  checkCancellation: () => boolean = () => false,
): Promise<Book[]> {
  let all: Book[] = [];
  for (const aw of awards) {
    if (checkCancellation()) break;
    all = all.concat(await fetchAwardPage(wiki, aw.title, aw.name, sendEvent));
  }
  return all;
}
