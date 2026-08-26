import { NotionBook } from "../src/types";
import { sanitizeNotionString, isValidUrl } from "../utils";
import { buildAuthorTags } from "./bookDiff";
import { CYCLE_VOLUME_CATEGORY, isCycleVolume } from "./bookCategory";
import { parseVintedData } from "./vintedStore";
import { encyclopediaUrl } from "../src/utils/encyclopedia";

/** „Tytuł polski" property with a link to the encyclopedia (as in the original rituals). */
export function buildCycleTitleProperty(title: string): Record<string, any> {
  const link = encyclopediaUrl(title);
  return { rich_text: [{ text: { content: sanitizeNotionString(title || ""), ...(isValidUrl(link) ? { link: { url: link } } : {}) } }] };
}

/**
 * Cycle-volume rows in the database (option A). Side cycle volumes are REAL rows
 * with `Kategoria=Tom cyklu`, so they can be tagged (read/owned) and
 * scanned on Vinted. Grouped by the `Cykl` field, ordered by `CyklNr`.
 */

/** Cheapest Vinted offer for a volume (from the VintedData blob collected by the scanner). */
export interface VolumeOffer {
  price: number;
  url: string;
  /** Total number of offers for this volume. */
  count: number;
}

/** View of a single volume in Archiwum Cykli (aggregated from rows). */
export interface HarvestVolume {
  /** Notion row ID — for tagging (read/owned) from the card. */
  id: string;
  title: string;
  /** Always true — the volume is a database row (kept for card compatibility). */
  inBase: boolean;
  read: boolean;
  owned: boolean;
  awarded: boolean;
  /** Whether this is an award entry (anchor) or a side cycle volume. */
  isAward: boolean;
  /** Cheapest Vinted offer (if the scanner found something). */
  vinted?: VolumeOffer;
}

/** Cheapest offer from a row's VintedData blob (only prices > 0). */
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
  /** „Do zdobycia" = neither owned nor read. */
  missing: number;
  /** Kept for shape compatibility (= number of volumes, since all are rows). */
  inBase: number;
  /** Cost to complete: sum of the cheapest Vinted offers for „do zdobycia" volumes. */
  acquireCost?: number;
  /** How many „do zdobycia" volumes have a Vinted offer. */
  acquirable: number;
}
export interface CyclesHarvest {
  cycles: HarvestCycle[];
  totalCycles: number;
  harvestedAt: number | null;
}

/**
 * Label of the „Lp" (title) column for a cycle volume: „Nazwa cyklu (nr)", e.g. „Mistborn (3)".
 * Stable (independent of Lp renumbering), readable, clearly distinguishes a volume from an award number.
 */
export function cycleLpLabel(cycleName: string, nr: number): string {
  return `${(cycleName || "Cykl").trim()} (${nr})`;
}

/** Payload for a new side cycle-volume row. */
export function buildCycleVolumeProperties(input: { title: string; author?: string; cycleName: string; nr: number }): Record<string, any> {
  const title = sanitizeNotionString(input.title || "");
  const properties: Record<string, any> = {
    "Lp": { title: [{ text: { content: sanitizeNotionString(cycleLpLabel(input.cycleName, input.nr)) } }] },
    // „Tytuł polski" with a link to the encyclopedia — as in the original rituals.
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
 * Aggregates rows belonging to cycles (non-empty `Cykl` field) into a cycle list for Archiwum.
 * Groups by cycle name, sorts by `CyklNr` (then by title), computes statuses from the
 * „Źródło"/„Nagroda" fields. Includes both award anchors and side cycle volumes.
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
    // Completion cost = sum of the cheapest offers for „do zdobycia" volumes that are on Vinted.
    const withOffer = toGet.filter((v) => v.vinted);
    const acquireCost = withOffer.length > 0 ? Math.round(withOffer.reduce((s, v) => s + v.vinted!.price, 0)) : undefined;
    return {
      cycle: g.name, volumes, total: volumes.length, owned, read,
      missing: toGet.length, inBase: volumes.length,
      acquireCost, acquirable: withOffer.length,
    };
  });
  // Most „do zdobycia" on top; completed ones (missing 0) fall to the bottom.
  cycles.sort((a, b) => b.missing - a.missing || b.total - a.total || a.cycle.localeCompare(b.cycle));

  return { cycles, totalCycles: cycles.length, harvestedAt: null };
}
