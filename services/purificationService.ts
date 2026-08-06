import pLimit from "p-limit";
import { NotionAdapter } from "../notion.adapter";
import { SyncEvent } from "../src/types";
import { stripWikiFormatting, sanitizeNotionString, isValidUrl } from "../utils";

export class PurificationService {
  constructor(private notion: NotionAdapter) {}

  async runPurification(sendEvent: (data: SyncEvent) => void, checkCancellation: () => boolean) {
    try {
      sendEvent({ type: "status", message: "Inicjalizacja bazy Notion..." });
      await this.notion.init();

      sendEvent({ type: "status", message: "Pobieranie listy książek z Notion..." });
      const existingBooks = await this.notion.queryAllBooks(
        (count) => sendEvent({ type: "status", message: `Pobrano ${count} książek z Notion...` }),
        checkCancellation
      );

      if (checkCancellation()) {
        sendEvent({ type: "status", message: "Przerwano rytuał puryfikacji." });
        return;
      }

      sendEvent({ type: "status", message: "Oczyszczanie danych w istniejących rekordach Notion..." });
      let cleanedCount = 0;
      let processedCount = 0;
      const syncSummary = { updated: [] as string[], skipped: [] as string[] };
      const errors: any[] = [];
      const limit = pLimit(3);

      const syncTasks = existingBooks.map((eb) => limit(async () => {
        if (checkCancellation()) return;
        
        processedCount++;
        if (processedCount % 10 === 0 || processedCount === existingBooks.length) {
          sendEvent({ type: "progress", message: "Oczyszczanie danych...", current: processedCount, total: existingBooks.length });
        }

        try {
          const cleanPl = stripWikiFormatting(eb.plTitle || "");
          const cleanOrig = stripWikiFormatting(eb.origTitle || "");

          // Check if Notion has native formatting (italics, bold, etc.)
          const hasNativeFormatting = (richText: any[]) => {
            return richText?.some(part => 
              part.annotations && (
                part.annotations.italic || 
                part.annotations.bold || 
                part.annotations.strikethrough || 
                part.annotations.underline || 
                part.annotations.code
              )
            );
          };

          const updates: any = {};
          const needsPlUpdate = (eb.plTitle && eb.plTitle !== cleanPl) || hasNativeFormatting(eb.plTitleRichText || []);
          const needsOrigUpdate = (eb.origTitle && eb.origTitle !== cleanOrig) || hasNativeFormatting(eb.origTitleRichText || []);

          if (needsPlUpdate) {
            const link = eb.plTitleRichText?.[0]?.text?.link?.url || eb.plTitleRichText?.[0]?.href;
            const sanitizedPl = sanitizeNotionString(cleanPl);
            updates["Tytuł polski"] = { rich_text: [{ text: { content: sanitizedPl, ...(isValidUrl(link) ? { link: { url: link } } : {}) } }] };
          }
          if (needsOrigUpdate) {
            const link = eb.origTitleRichText?.[0]?.text?.link?.url || eb.origTitleRichText?.[0]?.href;
            const sanitizedOrig = sanitizeNotionString(cleanOrig);
            updates["Tytuł oryginalny"] = { rich_text: [{ text: { content: sanitizedOrig, ...(isValidUrl(link) ? { link: { url: link } } : {}) } }] };
          }

          if (Object.keys(updates).length > 0) {
            await this.notion.updatePage(eb.id, updates);
            cleanedCount++;
            const title = eb.plTitle || eb.origTitle || "Nieznany tytuł";
            syncSummary.updated.push(`${title} (Oczyszczono formatowanie)`);
          } else {
            syncSummary.skipped.push(eb.plTitle || eb.origTitle || "Nieznany tytuł");
          }
        } catch (err: any) {
          errors.push({ book: eb.plTitle || eb.origTitle, error: err.message });
        }
      }));

      await Promise.all(syncTasks);

      sendEvent({
        type: "complete",
        result: {
          found: existingBooks.length,
          synced: 0,
          updated: cleanedCount,
          summary: syncSummary,
          errors: errors.map(e => `${e.book}: ${e.error}`)
        }
      });
    } catch (error: any) {
      sendEvent({ type: "error", error: error.message });
    }
  }
}
