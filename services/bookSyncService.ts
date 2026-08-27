import pLimit from "p-limit";
import { NotionAdapter } from "../notion.adapter";
import { WikiAdapter } from "../wiki.adapter";
import { calculateSimilarity, countCommonWords, cleanTitle } from "../utils";
import { Book, NotionBook, SyncEvent, SyncParams } from "../src/types";
import { normalizeData } from "./dataNormalizer";
import { buildBookUpdates, buildNewBookProperties } from "./bookDiff";
import { isCycleVolume, AWARD_CATEGORY } from "./bookCategory";
import { ConfigService } from "./configService";
import { fetchAwardPage, fetchAwardBooks } from "./awardBooksSource";

export class BookSyncService {
  constructor(private notion: NotionAdapter, private wiki: WikiAdapter, private config: ConfigService) {}

  /** Thin pass-through to the shared award-page source (kept for callers that
   *  fetch a single award page by title). */
  async fetchBooksFromMediaWiki(pageTitle: string, awardName: string, sendEvent: (data: SyncEvent) => void): Promise<Book[]> {
    return fetchAwardPage(this.wiki, pageTitle, awardName, sendEvent);
  }

  async runBookSync(params: SyncParams, sendEvent: (data: SyncEvent) => void, checkCancellation: () => boolean) {
    try {
      sendEvent({ type: "status", message: "Inicjalizacja bazy Notion..." });
      await this.notion.init();
      let allBooksToSync: Book[] = [];
      if (params.syncAll) {
        // List of award pages from config (knob `sync.awards`) — no copy in code.
        const awards = (await this.config.getConfig()).sync.awards;
        allBooksToSync = await fetchAwardBooks(this.wiki, awards, sendEvent, checkCancellation);
      } else if (params.pageTitle && params.awardName) {
        allBooksToSync = await fetchAwardPage(this.wiki, params.pageTitle, params.awardName, sendEvent);
      }
      if (checkCancellation()) {
        sendEvent({ type: "error", error: "Synchronizacja przerwana przez użytkownika." });
        return;
      }
      const mergedBooksMap = new Map<string, Book>();
      for (const book of allBooksToSync) {
        const normalizedAuthor = normalizeData(book.author || "", 'author');
        const key = `${book.polishTitle || book.originalTitle}|${normalizedAuthor}`.trim().toLowerCase();
        if (!key) continue;
        if (mergedBooksMap.has(key)) {
          const existing = mergedBooksMap.get(key)!;
          if (!existing.awards?.includes(book.award)) existing.awards?.push(book.award);
        } else {
          book.awards = [book.award];
          book.author = normalizedAuthor; // Store normalized author
          mergedBooksMap.set(key, book);
        }
      }
      const booksToSync = Array.from(mergedBooksMap.values());
      sendEvent({ type: "status", message: "Skanowanie bazy danych Notion..." });
      const existingBooks = await this.notion.queryAllBooks(
        (count) => sendEvent({ type: "status", message: `Pobrano ${count} książek z Notion...` }),
        checkCancellation
      );

      const existingBooksMap = new Map<string, NotionBook>();
      for (const book of existingBooks) {
        const normalizedAuthor = normalizeData(cleanTitle(book.author || ""), 'author');
        const cleanedPl = normalizeData(cleanTitle(book.plTitle || ""), 'title');
        const cleanedOrig = normalizeData(cleanTitle(book.origTitle || ""), 'title');
        
        if (cleanedPl) {
          const key = `${cleanedPl}|${normalizedAuthor}`.toLowerCase();
          existingBooksMap.set(key, book);
        }
        if (cleanedOrig) {
          const key = `${cleanedOrig}|${normalizedAuthor}`.toLowerCase();
          existingBooksMap.set(key, book);
        }
      }
      let synced = 0, updated = 0;
      const syncSummary = { added: [] as string[], updated: [] as string[], skipped: [] as string[], duplicates: [] as string[] };
      const errors: any[] = [];
      
      const limit = pLimit((await this.config.getConfig()).sync.writeConcurrency);
      let processedCount = 0;

      const syncTasks = booksToSync.map((book) => limit(async () => {
        if (checkCancellation()) return;
        
        processedCount++;
        if (processedCount % 5 === 0 || processedCount === booksToSync.length) {
          sendEvent({ type: "progress", message: "Zapisywanie danych do bazy Notion...", current: processedCount, total: booksToSync.length });
        }
        
        try {
          const searchKeyPL = `${cleanTitle(book.polishTitle || "")}|${book.author}`.toLowerCase();
          const searchKeyOrig = `${cleanTitle(book.originalTitle || "")}|${book.author}`.toLowerCase();
          let existingBook = existingBooksMap.get(searchKeyPL) || existingBooksMap.get(searchKeyOrig);
          const bookDisplayName = `${book.polishTitle || book.originalTitle} - ${book.author} (${book.year})`;
          
          let isDuplicateFound = false;
          if (!existingBook) {
            // Check for potential duplicates
            for (const [titleWithAuthor, bookData] of existingBooksMap.entries()) {
              let isDuplicate = false;
              
              // Check if authors are similar
              const authorA = (book.author || "").toLowerCase().trim();
              const authorB = (bookData.author || "").toLowerCase().trim();
              const sameAuthor = authorA && authorB && (authorA === authorB || calculateSimilarity(authorA, authorB) > 0.85);

              // Strict rule: at least 2 common significant words in original title AND same author
              if (sameAuthor && book.originalTitle && bookData.origTitle && countCommonWords(book.originalTitle, bookData.origTitle) >= 2) {
                isDuplicate = true;
              }

              if (isDuplicate) {
                syncSummary.duplicates.push(`${bookDisplayName} (duplikat: ${bookData.origTitle || titleWithAuthor} - dopasowanie słów + autor)`);
                isDuplicateFound = true;
                break;
              }
            }
          }

          if (isDuplicateFound) return;

          if (existingBook) {
            const updates = buildBookUpdates(existingBook, book);
            // Promotion: the award ritual processes laureates, so if it hit a row
            // tagged as „Tom cyklu", that volume IS in fact awarded — we move it
            // to Kategoria=Nagroda (otherwise it would stay hidden in award stats).
            if (isCycleVolume(existingBook)) {
              updates["Kategoria"] = { select: { name: AWARD_CATEGORY } };
            }
            if (Object.keys(updates).length > 0) {
              await this.notion.updatePage(existingBook.id, updates);
              updated++;
              const updatedFields = Object.keys(updates).join(', ');
              syncSummary.updated.push(`${bookDisplayName} (Zaktualizowano: ${updatedFields})`);
            } else {
              syncSummary.skipped.push(bookDisplayName);
            }
          } else {
            await this.notion.addRow(buildNewBookProperties(book));
            synced++;
            syncSummary.added.push(bookDisplayName);
          }
        } catch (err: any) {
          errors.push({ book: book.polishTitle, error: err.message });
        }
      }));

      await Promise.all(syncTasks);

      sendEvent({ type: "complete", result: { synced, updated, summary: syncSummary, errors: errors.map(e => `${e.book}: ${e.error}`) } });
    } catch (error: any) {
      sendEvent({ type: "error", error: error.message });
    }
  }
}
