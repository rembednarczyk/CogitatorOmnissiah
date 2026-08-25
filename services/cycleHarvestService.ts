import pLimit from "p-limit";
import { NotionAdapter } from "../notion.adapter";
import { SyncEvent, NotionBook } from "../src/types";
import { ConfigService } from "./configService";
import { CycleLookupService, normTitle } from "./cycleLookupService";
import { buildCycleVolumeProperties, cycleLpLabel, cycleVolumeEncyclopediaUrl, buildCycleTitleProperty } from "./cycleRows";
import { isCycleVolume } from "./bookCategory";
import { sanitizeNotionString } from "../utils";
import { createLogger } from "../logger";

const log = createLogger("CycleHarvest");

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
      // Indeks po TEJ SAMEJ normalizacji co cross-ref w lookup (normTitle) — inaczej
      // „inBase" z lookup i dopasowanie tutaj się rozjeżdżają i tworzymy duplikat.
      const byTitle = new Map<string, NotionBook>();
      for (const b of books) {
        for (const t of [b.plTitle, b.origTitle]) if (t && t.trim()) byTitle.set(normTitle(t), b);
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

          // Nazwa cyklu ustalona RAZ i sanityzowana — tak jak przy tworzeniu wiersza,
          // inaczej guard `existing.cykl !== …` porównywałby surowe vs zsanityzowane i
          // przepisywał Cykl co przebieg.
          const cyc = sanitizeNotionString(view.cycleName);
          const cycleKey = normTitle(cyc);
          // Cykl rozwijamy raz — kolejna kotwica tego samego cyklu tylko się dotaguje.
          if (cycleKey && processedCycles.has(cycleKey)) return;
          if (cycleKey) processedCycles.add(cycleKey);

          let nr = 0;
          for (const vol of view.volumes) {
            if (checkCancellation()) return;
            const title = (vol.title || "").trim();
            if (!title) continue;              // pomiń puste tytuły (brak junk-wiersza)
            nr++;
            const key = normTitle(title);
            const existing = byTitle.get(key);
            if (existing && !existing.id) {
              // Rezerwacja innego zadania (wiersz w trakcie tworzenia) — nie duplikuj.
              continue;
            } else if (existing) {
              // Istnieje realny wiersz — dotaguj Cykl/CyklNr (nie duplikuj). Dla wierszy
              // tomów cykli ujednolić też Lp i link; kotwic nagrodowych (numer w Lp) NIE.
              const props: Record<string, any> = {};
              if (existing.cykl !== cyc || existing.cyklNr !== nr) {
                props["Cykl"] = { rich_text: [{ text: { content: cyc } }] };
                props["CyklNr"] = { number: nr };
              }
              if (isCycleVolume(existing)) {
                const label = cycleLpLabel(cyc, nr);
                if (existing.lp !== label) props["Lp"] = { title: [{ text: { content: label } }] };
                const wantLink = cycleVolumeEncyclopediaUrl(existing.plTitle || title);
                const curLink = existing.plTitleRichText?.[0]?.text?.link?.url;
                if (curLink !== wantLink) props["Tytuł polski"] = buildCycleTitleProperty(existing.plTitle || title);
              }
              if (Object.keys(props).length > 0) {
                await this.notion.updatePage(existing.id, props);
                taggedTitles.push(`${existing.plTitle || existing.origTitle} (${cyc} ${nr})`);
                existing.cykl = cyc; existing.cyklNr = nr;
                if (isCycleVolume(existing)) existing.lp = cycleLpLabel(cyc, nr);
              }
            } else {
              // Brak wiersza — REZERWUJ slot SYNCHRONICZNIE (przed await), potem utwórz.
              // Równoległe zadanie zobaczy rezerwację (id="") i pominie ten tytuł.
              const reserved = { id: "", plTitle: title, origTitle: "", cykl: cyc, cyklNr: nr } as NotionBook;
              byTitle.set(key, reserved);
              const created = await this.notion.addRow(buildCycleVolumeProperties({
                title, author: anchor.author, cycleName: cyc, nr,
              }));
              reserved.id = created?.id ?? "";
              createdTitles.push(`${title} (${cyc})`);
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
