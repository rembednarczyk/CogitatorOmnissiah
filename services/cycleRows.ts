import { NotionBook } from "../src/types";
import { sanitizeNotionString, isValidUrl } from "../utils";
import { buildAuthorTags } from "./bookDiff";
import { CYCLE_VOLUME_CATEGORY, isCycleVolume } from "./bookCategory";
import { parseVintedData } from "./vintedStore";

/**
 * Link do strony tomu w Archiwum Encyklopedii Fantastyki — tytuł tomu to nazwa strony
 * wiki (z łańcucha poprzednia/następna). Ten sam wzorzec co w parserze i w karcie
 * (spacje → „_"), więc link w Notion i w UI są identyczne.
 */
export function cycleVolumeEncyclopediaUrl(title: string): string {
  return `https://encyklopediafantastyki.pl/index.php?title=${encodeURIComponent((title || "").replace(/ /g, "_"))}`;
}

/** Właściwość „Tytuł polski" z linkiem do encyklopedii (jak w oryginalnych rytuałach). */
export function buildCycleTitleProperty(title: string): Record<string, any> {
  const link = cycleVolumeEncyclopediaUrl(title);
  return { rich_text: [{ text: { content: sanitizeNotionString(title || ""), ...(isValidUrl(link) ? { link: { url: link } } : {}) } }] };
}

/**
 * Wiersze tomów cykli w bazie (opcja A). Poboczne tomy cyklu są REALNYMI wierszami
 * z `Kategoria=Tom cyklu`, dzięki czemu można je oznaczać (przeczytane/posiadane) i
 * skanować na Vinted. Grupowanie po polu `Cykl`, kolejność po `CyklNr`.
 */

/** Najtańsza oferta Vinted dla tomu (z blobu VintedData, zbieranego skanerem). */
export interface VolumeOffer {
  price: number;
  url: string;
  /** Liczba ofert łącznie dla tego tomu. */
  count: number;
}

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
  /** Najtańsza oferta Vinted (jeśli skaner coś znalazł). */
  vinted?: VolumeOffer;
}

/** Najtańsza oferta z blobu VintedData wiersza (tylko ceny > 0). */
function cheapestVinted(raw?: string): VolumeOffer | undefined {
  const data = parseVintedData(raw);
  if (!data) return undefined;
  const priced = data.offers.filter((o) => typeof o.price === "number" && (o.price as number) > 0);
  if (priced.length === 0) return undefined;
  const best = priced.reduce((a, b) => ((b.price as number) < (a.price as number) ? b : a));
  return { price: best.price as number, url: best.url, count: data.offers.length };
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
  /** Koszt skompletowania: suma najtańszych ofert Vinted dla tomów „do zdobycia". */
  acquireCost?: number;
  /** Ile tomów „do zdobycia" ma ofertę Vinted. */
  acquirable: number;
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
    // Tytuł polski z linkiem do encyklopedii — jak w oryginalnych rytuałach.
    "Tytuł polski": buildCycleTitleProperty(input.title),
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
        vinted: cheapestVinted(r.vintedData),
      };
    });
    const owned = volumes.filter((v) => v.owned).length;
    const read = volumes.filter((v) => v.read).length;
    const toGet = volumes.filter((v) => !v.owned && !v.read);
    // Koszt kompletacji = suma najtańszych ofert dla tomów „do zdobycia", które są na Vinted.
    const withOffer = toGet.filter((v) => v.vinted);
    const acquireCost = withOffer.length > 0 ? Math.round(withOffer.reduce((s, v) => s + v.vinted!.price, 0)) : undefined;
    return {
      cycle: g.name, volumes, total: volumes.length, owned, read,
      missing: toGet.length, inBase: volumes.length,
      acquireCost, acquirable: withOffer.length,
    };
  });
  // Najwięcej „do zdobycia" na górze; ukończone (missing 0) spadają na dół.
  cycles.sort((a, b) => b.missing - a.missing || b.total - a.total || a.cycle.localeCompare(b.cycle));

  return { cycles, totalCycles: cycles.length, harvestedAt: null };
}
