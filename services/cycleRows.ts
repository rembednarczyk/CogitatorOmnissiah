import { NotionBook } from "../src/types";
import { sanitizeNotionString } from "../utils";
import { buildAuthorTags } from "./bookDiff";
import { CYCLE_VOLUME_CATEGORY, isCycleVolume } from "./bookCategory";

/**
 * Wiersze tomów cykli w bazie (opcja A). Poboczne tomy cyklu są REALNYMI wierszami
 * z `Kategoria=Tom cyklu`, dzięki czemu można je oznaczać (przeczytane/posiadane) i
 * skanować na Vinted. Grupowanie po polu `Cykl`, kolejność po `CyklNr`.
 */

/** Widok jednego tomu w Archiwum Cykli (agregacja z wierszy). */
export interface HarvestVolume {
  /** ID wiersza Notion — do oznaczania (przeczytane/posiadane) z karty. */
  id: string;
  title: string;
  /** Zawsze true — tom jest wierszem bazy (zachowane dla zgodności z kartą). */
  inBase: boolean;
  read: boolean;
  owned: boolean;
  awarded: boolean;
  /** Czy to pozycja nagrodowa (kotwica), czy poboczny tom cyklu. */
  isAward: boolean;
}
export interface HarvestCycle {
  cycle: string;
  volumes: HarvestVolume[];
  total: number;
  owned: number;
  read: number;
  /** „Do zdobycia" = ani posiadane, ani przeczytane. */
  missing: number;
  /** Zachowane dla zgodności kształtu (= liczba tomów, bo wszystkie są wierszami). */
  inBase: number;
}
export interface CyclesHarvest {
  cycles: HarvestCycle[];
  totalCycles: number;
  harvestedAt: number | null;
}

/**
 * Etykieta kolumny „Lp" (tytułowej) dla tomu cyklu: „Nazwa cyklu (nr)", np. „Mistborn (3)".
 * Stabilna (nie zależy od przenumerowań Lp), czytelna, jasno odróżnia tom od numeru nagrody.
 */
export function cycleLpLabel(cycleName: string, nr: number): string {
  return `${(cycleName || "Cykl").trim()} (${nr})`;
}

/** Payload nowego wiersza pobocznego tomu cyklu. */
export function buildCycleVolumeProperties(input: { title: string; author?: string; cycleName: string; nr: number }): Record<string, any> {
  const title = sanitizeNotionString(input.title || "");
  const properties: Record<string, any> = {
    "Lp": { title: [{ text: { content: sanitizeNotionString(cycleLpLabel(input.cycleName, input.nr)) } }] },
    "Tytuł polski": { rich_text: [{ text: { content: title } }] },
    "Kategoria": { select: { name: CYCLE_VOLUME_CATEGORY } },
    "Cykl": { rich_text: [{ text: { content: sanitizeNotionString(input.cycleName || "") } }] },
    "CyklNr": { number: input.nr },
    "Część cyklu": { checkbox: true },
  };
  if (input.author) {
    properties["Autor"] = { multi_select: buildAuthorTags(input.author).slice(0, 100).map((name) => ({ name })) };
  }
  return properties;
}

const normKey = (s: string): string => (s || "").toLowerCase().replace(/\s+/g, " ").trim();

/**
 * Agreguje wiersze należące do cykli (pole `Cykl` niepuste) w listę cykli do Archiwum.
 * Grupuje po nazwie cyklu, sortuje po `CyklNr` (potem po tytule), liczy statusy z pól
 * Źródło/Nagroda. Zawiera zarówno kotwice nagrodowe, jak i poboczne tomy cyklu.
 */
export function aggregateCycleRows(books: NotionBook[]): CyclesHarvest {
  const groups = new Map<string, { name: string; rows: NotionBook[] }>();
  for (const b of books) {
    const name = (b.cykl || "").trim();
    if (!name) continue;
    const key = normKey(name);
    let g = groups.get(key);
    if (!g) { g = { name, rows: [] }; groups.set(key, g); }
    g.rows.push(b);
  }

  const cycles: HarvestCycle[] = Array.from(groups.values()).map((g) => {
    const rows = g.rows.slice().sort((a, b) => {
      const na = a.cyklNr, nb = b.cyklNr;
      if (typeof na === "number" && typeof nb === "number" && na !== nb) return na - nb;
      if (typeof na === "number" && typeof nb !== "number") return -1;
      if (typeof na !== "number" && typeof nb === "number") return 1;
      return (a.plTitle || a.origTitle || "").localeCompare(b.plTitle || b.origTitle || "");
    });
    const volumes: HarvestVolume[] = rows.map((r) => {
      const zr = r.zrodlo || [];
      return {
        id: r.id,
        title: r.plTitle || r.origTitle || "",
        inBase: true,
        read: zr.includes("Przeczytane"),
        owned: zr.includes("Posiadam"),
        awarded: (r.awards || []).length > 0,
        isAward: !isCycleVolume(r),
      };
    });
    const owned = volumes.filter((v) => v.owned).length;
    const read = volumes.filter((v) => v.read).length;
    const missing = volumes.filter((v) => !v.owned && !v.read).length;
    return { cycle: g.name, volumes, total: volumes.length, owned, read, missing, inBase: volumes.length };
  });
  // Najwięcej „do zdobycia" na górze; ukończone (missing 0) spadają na dół.
  cycles.sort((a, b) => b.missing - a.missing || b.total - a.total || a.cycle.localeCompare(b.cycle));

  return { cycles, totalCycles: cycles.length, harvestedAt: null };
}
