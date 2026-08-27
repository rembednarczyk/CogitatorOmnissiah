import { NotionAdapter } from "../notion.adapter";
import { NotionBook, SyncEvent } from "../src/types";
import { scoreDuplicatePair } from "./bookMatch";
import { ConfigService } from "./configService";
import { isAwardBook } from "./bookCategory";
import { createLogger } from "../logger";

const log = createLogger("DuplicateSync");

export class DuplicateSyncService {
  constructor(private notion: NotionAdapter, private config: ConfigService) {}

  async runDuplicateCheck(sendEvent: (data: SyncEvent) => void, checkCancellation: () => boolean) {
    try {
      // Similarity thresholds from config (knobs `sync.dup*Threshold`).
      const { dupAuthorThreshold, dupTitleThreshold } = (await this.config.getConfig()).sync;
      sendEvent({ type: "status", message: "Inicjalizacja bazy Notion..." });
      await this.notion.init();
      sendEvent({ type: "status", message: "Pobieranie listy książek z Notion..." });
      const fetched: NotionBook[] = await this.notion.queryAllBooks((count) => sendEvent({ type: "status", message: `Pobrano ${count} książek z Notion...` }), checkCancellation);
      // Duplicate detection concerns award entries — side cycle volumes are
      // legitimately distinct books, not duplicates (excluded from comparisons).
      const allBooks: NotionBook[] = fetched.filter(isAwardBook);
      log.info(`Pobrano ${fetched.length} książek (${allBooks.length} nagrodowych po filtrze kategorii)`, { fetched: fetched.length, award: allBooks.length });

      const duplicates: { bookA: string; bookB: string; reason: string }[] = [];
      for (let i = 0; i < allBooks.length; i++) {
        if (checkCancellation()) { sendEvent({ type: "status", message: "Przerwano sprawdzanie duplikatów." }); break; }
        
        for (let j = i + 1; j < allBooks.length; j++) {
          const bookA = allBooks[i];
          const bookB = allBooks[j];

          const match = scoreDuplicatePair(bookA, bookB, { authorThreshold: dupAuthorThreshold, titleThreshold: dupTitleThreshold });
          if (match) {
            const displayA = `${bookA.plTitle || bookA.origTitle || "Unknown"}${bookA.author ? ` - ${bookA.author}` : ""}`;
            const displayB = `${bookB.plTitle || bookB.origTitle || "Unknown"}${bookB.author ? ` - ${bookB.author}` : ""}`;
            duplicates.push({ bookA: displayA, bookB: displayB, reason: match.reason });
          }
        }
        
        if (i % 10 === 0 || i === allBooks.length - 1) {
          sendEvent({ type: "progress", message: "Sprawdzanie duplikatów...", current: i + 1, total: allBooks.length });
        }
      }
      
      sendEvent({ type: "complete", result: { success: true, duplicates } });
    } catch (error: any) { sendEvent({ type: "error", error: error.message }); }
  }
}
