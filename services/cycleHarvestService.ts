import pLimit from "p-limit";
import { NotionAdapter } from "../notion.adapter";
import { SyncEvent, NotionBook } from "../src/types";
import { ConfigService } from "./configService";
import { CycleLookupService } from "./cycleLookupService";
import { buildCycleBlob, serializeCycleBlob, parseCycleBlob, sameCycleContent } from "./cycleHarvest";
import { createLogger } from "../logger";

const log = createLogger("CycleHarvest");

/**
 * Rytuał „Żniwa Cykli": dla każdej książki oznaczonej jako część cyklu zbiera
 * sąsiednie tomy (reużywa `CycleLookupService` — prev/next + {{Cykl}} + cross-ref
 * z bazą) i składuje je w blobie `CycleCache` na TEJ pozycji. To CACHE, nie nowe
 * wiersze bazy — świadomie nie dodajemy pobocznych tomów jako pozycji Notion.
 *
 * Rozdział odpowiedzialności: TU zbieramy strukturę cyklu (rzadko się zmienia);
 * dostępność na Vinted dopisze osobny przebieg skanera (inne tempo odświeżania).
 */
export class CycleHarvestService {
  constructor(
    private notion: NotionAdapter,
    private cycleLookup: CycleLookupService,
    private config: ConfigService,
  ) {}

  async runCycleHarvest(sendEvent: (data: SyncEvent) => void, checkCancellation: () => boolean): Promise<void> {
    try {
      sendEvent({ type: "status", message: "Sprawdzanie struktury bazy Notion..." });
      await this.notion.createColumnIfNeeded("CycleCache", "rich_text");

      sendEvent({ type: "status", message: "Pobieranie listy książek z Notion..." });
      const books: NotionBook[] = await this.notion.getBooksForStats(undefined, undefined, { cache: true });
      const cycleBooks = books.filter((b) => b.currentCzesccyklu);

      sendEvent({ type: "status", message: `Znaleziono ${cycleBooks.length} pozycji oznaczonych jako część cyklu. Odpytywanie Archiwum...` });
      if (cycleBooks.length === 0) {
        sendEvent({ type: "complete", result: { success: true, found: 0, written: 0, skipped: 0, noSiblings: 0, summary: { note: "Brak pozycji z zaznaczonym polem Część cyklu — uruchom najpierw Rytuał Oznaczania Cykli." } } });
        return;
      }

      // Delikatnie dla encyklopedii: lookup robi sekwencyjne fetsze łańcucha, więc
      // trzymamy niską współbieżność (max 3), niezależnie od writeConcurrency.
      const limit = pLimit(Math.min(3, Math.max(1, (await this.config.getConfig()).sync.writeConcurrency)));

      let processed = 0, written = 0, unchanged = 0, noSiblings = 0;
      const errors: { book: string; error: string }[] = [];

      const tasks = cycleBooks.map((book) => limit(async () => {
        if (checkCancellation()) return;
        const title = book.plTitle || book.origTitle;
        try {
          const view = await this.cycleLookup.lookup(title, book.author || "");
          // <=1 tom = brak sąsiadów do zebrania (albo strona bez danych cyklu).
          if (!view || view.volumes.length <= 1) {
            noSiblings++;
          } else {
            const blob = buildCycleBlob(view, Date.now());
            const existing = parseCycleBlob(book.cycleCache);
            if (sameCycleContent(blob, existing)) {
              unchanged++;
            } else {
              await this.notion.saveCycleCache(book.id, serializeCycleBlob(blob));
              written++;
            }
          }
        } catch (err: any) {
          errors.push({ book: title, error: err?.message || String(err) });
        } finally {
          processed++;
          if (processed % 5 === 0 || processed === cycleBooks.length) {
            sendEvent({ type: "progress", current: processed, total: cycleBooks.length, message: `Zebrano ${processed}/${cycleBooks.length} cykli...` });
          }
        }
      }));

      await Promise.all(tasks);

      log.info("Żniwa cykli zakończone", { found: cycleBooks.length, written, unchanged, noSiblings, errors: errors.length });
      sendEvent({
        type: "complete",
        result: {
          success: !checkCancellation(),
          found: cycleBooks.length,
          written,
          unchanged,
          noSiblings,
          summary: {
            updated: [`Zapisano tomy cyklu dla ${written} pozycji`],
            skipped: [
              `${unchanged} bez zmian`,
              `${noSiblings} bez sąsiednich tomów`,
            ],
          },
          errors: errors.length > 0 ? errors : undefined,
        },
      });
    } catch (error: any) {
      sendEvent({ type: "error", error: error.message });
    }
  }
}
