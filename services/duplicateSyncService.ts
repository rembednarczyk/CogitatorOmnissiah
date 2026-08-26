import { NotionAdapter } from "../notion.adapter";
import { WikiAdapter } from "../wiki.adapter";
import { NotionBook, SyncEvent } from "../src/types";
import { countCommonWords, calculateSimilarity } from "../utils";
import { ConfigService } from "./configService";
import { isAwardBook } from "./bookCategory";

export class DuplicateSyncService {
  constructor(private notion: NotionAdapter, private wiki: WikiAdapter, private config: ConfigService) {}

  async runDuplicateCheck(sendEvent: (data: SyncEvent) => void, checkCancellation: () => boolean) {
    console.log("DuplicateSyncService runDuplicateCheck started");
    try {
      // Similarity thresholds from config (knobs `sync.dup*Threshold`).
      const { dupAuthorThreshold, dupTitleThreshold } = (await this.config.getConfig()).sync;
      sendEvent({ type: "status", message: "Inicjalizacja bazy Notion..." });
      await this.notion.init();
      console.log("Notion initialized");
      sendEvent({ type: "status", message: "Pobieranie listy książek z Notion..." });
      const fetched: NotionBook[] = await this.notion.queryAllBooks((count) => sendEvent({ type: "status", message: `Pobrano ${count} książek z Notion...` }), checkCancellation);
      // Duplicate detection concerns award entries — side cycle volumes are
      // legitimately distinct books, not duplicates (excluded from comparisons).
      const allBooks: NotionBook[] = fetched.filter(isAwardBook);
      console.log(`Fetched ${fetched.length} books (${allBooks.length} award after category filter)`);
      
      const duplicates: { bookA: string; bookB: string; reason: string }[] = [];
      for (let i = 0; i < allBooks.length; i++) {
        if (checkCancellation()) { sendEvent({ type: "status", message: "Przerwano sprawdzanie duplikatów." }); break; }
        
        for (let j = i + 1; j < allBooks.length; j++) {
          const bookA = allBooks[i];
          const bookB = allBooks[j];
          
          const titleA = (bookA.plTitle || "").toLowerCase().trim();
          const titleB = (bookB.plTitle || "").toLowerCase().trim();
          const origA = (bookA.origTitle || "").toLowerCase().trim();
          const origB = (bookB.origTitle || "").toLowerCase().trim();
          const authorA = (bookA.author || "").toLowerCase().trim();
          const authorB = (bookB.author || "").toLowerCase().trim();
          
          if ((!titleA && !origA) || (!titleB && !origB)) continue;
          
          let isDuplicate = false;
          let reason = "";
          
          const sameAuthor = authorA && authorB && (authorA === authorB || calculateSimilarity(authorA, authorB) > dupAuthorThreshold);
          const differentAuthor = authorA && authorB && !sameAuthor && calculateSimilarity(authorA, authorB) < 0.5; // Clearly different

          if (differentAuthor) continue; 
          
          // 1. Exact match for Polish title
          if (titleA && titleB && titleA === titleB) {
            isDuplicate = true;
            reason = "identyczny tytuł PL";
          } 
          // 2. Exact match for Original title
          else if (origA && origB && origA === origB) {
            isDuplicate = true;
            reason = "identyczny tytuł oryg.";
          }
          // 3. High similarity for Polish title
          else if (titleA && titleB && calculateSimilarity(titleA, titleB) > dupTitleThreshold) {
            isDuplicate = true;
            reason = "wysokie podobieństwo PL";
          }
          // 4. High similarity for Original title
          else if (origA && origB && calculateSimilarity(origA, origB) > dupTitleThreshold) {
            isDuplicate = true;
            reason = "wysokie podobieństwo oryg.";
          }
          // 5. Common words (at least 2) + same author
          else if (sameAuthor && ((origA && origB && countCommonWords(origA, origB) >= 2) || (titleA && titleB && countCommonWords(titleA, titleB) >= 2))) {
            isDuplicate = true;
            reason = "dopasowanie słów + ten sam autor";
          }
          // 6. Common words (at least 2) for Original title
          else if (origA && origB && countCommonWords(origA, origB) >= 2) {
            isDuplicate = true;
            reason = "dopasowanie słów oryg.";
          }
          // 7. Common words (at least 2) for Polish title
          else if (titleA && titleB && countCommonWords(titleA, titleB) >= 2) {
            isDuplicate = true;
            reason = "dopasowanie słów PL";
          }
          
          if (isDuplicate) {
            const displayA = `${bookA.plTitle || bookA.origTitle || "Unknown"}${bookA.author ? ` - ${bookA.author}` : ""}`;
            const displayB = `${bookB.plTitle || bookB.origTitle || "Unknown"}${bookB.author ? ` - ${bookB.author}` : ""}`;
            duplicates.push({ 
              bookA: displayA,
              bookB: displayB,
              reason
            });
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
