import pLimit from "p-limit";
import { NotionAdapter } from "../notion.adapter";
import { SyncEvent, NotionBook } from "../src/types";
import { ConfigService } from "./configService";
import { CycleLookupService } from "./cycleLookupService";
import { buildCycleVolumeProperties, cycleLpLabel } from "./cycleRows";
import { isCycleVolume } from "./bookCategory";
import { createLogger } from "../logger";

const log = createLogger("CycleHarvest");

const normKey = (s: string): string => (s || "").toLowerCase().replace(/\s+/g, " ").trim();

/**
 * Rytuał „Żniwa Cykli": dla każdej książki oznaczonej jako część cyklu zbiera
 * sąsiednie tomy (reużywa `CycleLookupService`) i materializuje je jako REALNE
 * wiersze bazy (`Kategoria=Tom cyklu`, pole `Cykl`/`CyklNr`). Dzięki temu tomy można
 * oznaczać (przeczytane/posiadane) i skanować na Vinted — poprzednio siedziały w
 * blobie i nie dało się ich oznaczyć (opcja A wybrana przez użytkownika).
 *
 * Idempotentny: istniejący wiersz (po znorm. tytule) nie jest duplikowany, a tylko
 * dotagowany polem `Cykl`/`CyklNr`, jeśli go nie miał. Cykl przetwarzany raz, nawet
 * gdy ma kilka kotwic nagrodowych.
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
      await this.notion.createColumnIfNeeded("Kategoria", "select");
      await this.notion.createColumnIfNeeded("Cykl", "rich_text");
      await this.notion.createColumnIfNeeded("CyklNr", "number");
      await this.notion.createColumnIfNeeded("Część cyklu", "checkbox");

      sendEvent({ type: "status", message: "Pobieranie listy książek z Notion..." });
      const books: NotionBook[] = await this.notion.getBooksForStats(undefined, checkCancellation, { cache: true });

      // Indeks istniejących wierszy po znorm. tytule (polski + oryginalny) — żeby nie
      // tworzyć duplikatów i móc dotagować istniejące pozycje polem Cykl.
      const byTitle = new Map<string, NotionBook>();
      for (const b of books) {
        for (const t of [b.plTitle, b.origTitle]) if (t && t.trim()) byTitle.set(normKey(t), b);
      }

      const cycleAnchors = books.filter((b) => b.currentCzesccyklu && !isCycleVolume(b));
      sendEvent({ type: "status", message: `Kotwic cyklu: ${cycleAnchors.length}. Odpytywanie Archiwum...` });
      if (cycleAnchors.length === 0) {
        sendEvent({ type: "complete", result: { success: true, found: 0, updated: 0 } });
        return;
      }

      const limit = pLimit(Math.min(3, Math.max(1, (await this.config.getConfig()).sync.writeConcurrency)));
      const processedCycles = new Set<string>(); // nazwy cykli już rozwinięte (dedup po kotwicach)
      const createdTitles: string[] = [];
      const taggedTitles: string[] = [];
      const noSiblingTitles: string[] = [];
      const errors: { book: string; error: string }[] = [];
      let processed = 0;

      const tasks = cycleAnchors.map((anchor) => limit(async () => {
        if (checkCancellation()) return;
        const anchorTitle = anchor.plTitle || anchor.origTitle;
        try {
          const view = await this.cycleLookup.lookup(anchorTitle, anchor.author || "");
          if (!view || view.volumes.length <= 1) { noSiblingTitles.push(anchorTitle); return; }

          const cycleKey = normKey(view.cycleName);
          // Cykl rozwijamy raz — kolejna kotwica tego samego cyklu tylko się dotaguje.
          if (cycleKey && processedCycles.has(cycleKey)) return;
          if (cycleKey) processedCycles.add(cycleKey);

          for (let i = 0; i < view.volumes.length; i++) {
            if (checkCancellation()) return;
            const vol = view.volumes[i];
            const nr = i + 1;
            const existing = byTitle.get(normKey(vol.title));
            if (existing) {
              // Istnieje jako wiersz — dotaguj Cykl/CyklNr (nie duplikuj). Dla wierszy
              // tomów cykli ujednolić też etykietę Lp; kotwic nagrodowych (numer w Lp)
              // NIE dotykamy.
              const props: Record<string, any> = {};
              if (existing.cykl !== view.cycleName || existing.cyklNr !== nr) {
                props["Cykl"] = { rich_text: [{ text: { content: view.cycleName } }] };
                props["CyklNr"] = { number: nr };
              }
              if (isCycleVolume(existing)) {
                const label = cycleLpLabel(view.cycleName, nr);
                if (existing.lp !== label) props["Lp"] = { title: [{ text: { content: label } }] };
              }
              if (Object.keys(props).length > 0) {
                await this.notion.updatePage(existing.id, props);
                taggedTitles.push(`${existing.plTitle || existing.origTitle} (${view.cycleName} ${nr})`);
                existing.cykl = view.cycleName; existing.cyklNr = nr;
                if (isCycleVolume(existing)) existing.lp = cycleLpLabel(view.cycleName, nr);
              }
            } else {
              // Brak wiersza — utwórz poboczny tom cyklu (autor z kotwicy).
              const created = await this.notion.addRow(buildCycleVolumeProperties({
                title: vol.title, author: anchor.author, cycleName: view.cycleName, nr,
              }));
              createdTitles.push(`${vol.title} (${view.cycleName})`);
              // Dopisz do indeksu, by kolejna kotwica nie utworzyła duplikatu.
              const stub = { id: created?.id, plTitle: vol.title, origTitle: "", cykl: view.cycleName, cyklNr: nr } as NotionBook;
              byTitle.set(normKey(vol.title), stub);
            }
          }
        } catch (err: any) {
          errors.push({ book: anchorTitle, error: err?.message || String(err) });
        } finally {
          processed++;
          if (processed % 5 === 0 || processed === cycleAnchors.length) {
            sendEvent({ type: "progress", current: processed, total: cycleAnchors.length, message: `Rozwinięto ${processed}/${cycleAnchors.length} kotwic...` });
          }
        }
      }));

      await Promise.all(tasks);

      log.info("Żniwa cykli (wiersze) zakończone", { anchors: cycleAnchors.length, created: createdTitles.length, tagged: taggedTitles.length, noSiblings: noSiblingTitles.length, errors: errors.length });
      sendEvent({
        type: "complete",
        result: {
          success: !checkCancellation(),
          found: cycleAnchors.length,
          added: createdTitles.length,          // nowe wiersze tomów cykli
          updated: taggedTitles.length,         // istniejące pozycje dopięte do cyklu / migracja Lp
          summary: {
            added: createdTitles,               // panel „Nowe Zapisy"
            updated: taggedTitles,              // panel „Zaktualizowane"
            skipped: noSiblingTitles,           // panel „Pominięte" — kotwice bez sąsiednich tomów
          },
          errors: errors.length > 0 ? errors : undefined,
        },
      });
    } catch (error: any) {
      sendEvent({ type: "error", error: error.message });
    }
  }
}
