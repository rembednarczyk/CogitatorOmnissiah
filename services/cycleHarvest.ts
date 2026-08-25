import { CycleView } from "./cycleLookupService";

/**
 * Czyste helpery formatu blobu „CycleCache" — zebranych tomów cyklu składowanych
 * per-książka w Notion (rich_text, wzorzec jak `VintedData`). Blob jest kompaktowy
 * (klucze jednoliterowe, flagi 0/1), bo pole rich_text ma limit ~2000 znaków na
 * segment — jedna książka trzyma TYLKO tomy swojego cyklu (kilka–kilkanaście).
 *
 * UWAGA: to jest CACHE (dane z encyklopedii na żądanie), a NIE osobne wiersze bazy —
 * świadomie nie dodajemy tych tomów jako pozycji w Notion.
 */

export interface CycleBlobVol {
  /** Tytuł tomu. */ t: string;
  /** isCurrent (0/1). */ cur: 0 | 1;
  /** inBase — jest jako wiersz w bazie (0/1). */ b: 0 | 1;
  /** read (0/1). */ r: 0 | 1;
  /** owned (0/1). */ o: 0 | 1;
  /** awarded (0/1). */ a: 0 | 1;
}

export interface CycleBlob {
  /** Wersja formatu (migracje). */ v: 1;
  /** Znacznik czasu zebrania (epoch ms). */ ts: number;
  /** Nazwa cyklu. */ cycle: string;
  /** Źródło listy: chain / template / mixed / single. */ src: CycleView["source"];
  /** Tomy w kolejności czytania. */ vols: CycleBlobVol[];
}

const bit = (b: boolean): 0 | 1 => (b ? 1 : 0);

/** Jeden tom w zagregowanym widoku cyklu (statusy scalone OR-em między pozycjami). */
export interface HarvestVolume {
  title: string;
  inBase: boolean;
  read: boolean;
  owned: boolean;
  awarded: boolean;
}
/** Jeden cykl w Archiwum: tomy w kolejności + liczniki. */
export interface HarvestCycle {
  cycle: string;
  volumes: HarvestVolume[];
  total: number;
  /** Ile tomów jest w bazie (jako wiersz). */ inBase: number;
  owned: number;
  read: number;
  /** Ile tomów NIE ma w bazie (kandydaci do zdobycia). */ missing: number;
}
export interface CyclesHarvest {
  cycles: HarvestCycle[];
  totalCycles: number;
  /** Najświeższy znacznik zebrania spośród blobów (epoch ms), null gdy brak danych. */
  harvestedAt: number | null;
}

const normKey = (s: string): string => (s || "").toLowerCase().replace(/\s+/g, " ").trim();

/**
 * Scala bloby `CycleCache` z wielu pozycji w listę cykli do Archiwum: grupuje po
 * nazwie cyklu, dedupuje tomy po tytule (statusy OR-owane), kolejność bierze z
 * pierwszego napotkanego blobu danego cyklu, dopisując brakujące tomy na końcu.
 * Czyste — wejściem jest lista książek (tylko pole `cycleCache`).
 */
export function mergeCycleCaches(books: { cycleCache?: string }[]): CyclesHarvest {
  const groups = new Map<string, { name: string; order: string[]; vols: Map<string, HarvestVolume> }>();
  let harvestedAt: number | null = null;

  for (const book of books) {
    const blob = parseCycleBlob(book.cycleCache);
    if (!blob || blob.vols.length === 0) continue;
    if (blob.ts) harvestedAt = harvestedAt === null ? blob.ts : Math.max(harvestedAt, blob.ts);

    const gKey = normKey(blob.cycle);
    let g = groups.get(gKey);
    if (!g) { g = { name: blob.cycle, order: [], vols: new Map() }; groups.set(gKey, g); }

    for (const v of blob.vols) {
      const vKey = normKey(v.t);
      const existing = g.vols.get(vKey);
      if (existing) {
        // Scal statusy OR-em (posiadanie/przeczytanie/nagroda widoczne z dowolnej pozycji).
        existing.inBase = existing.inBase || !!v.b;
        existing.read = existing.read || !!v.r;
        existing.owned = existing.owned || !!v.o;
        existing.awarded = existing.awarded || !!v.a;
      } else {
        g.order.push(vKey);
        g.vols.set(vKey, { title: v.t, inBase: !!v.b, read: !!v.r, owned: !!v.o, awarded: !!v.a });
      }
    }
  }

  const cycles: HarvestCycle[] = Array.from(groups.values()).map((g) => {
    const volumes = g.order.map((k) => g.vols.get(k)!);
    const inBase = volumes.filter((v) => v.inBase).length;
    return {
      cycle: g.name,
      volumes,
      total: volumes.length,
      inBase,
      owned: volumes.filter((v) => v.owned).length,
      read: volumes.filter((v) => v.read).length,
      missing: volumes.length - inBase,
    };
  });
  // Najciekawsze na górze: najwięcej brakujących tomów (najwięcej do zdobycia).
  cycles.sort((a, b) => b.missing - a.missing || b.total - a.total || a.cycle.localeCompare(b.cycle));

  return { cycles, totalCycles: cycles.length, harvestedAt };
}

/** Buduje kompaktowy blob z widoku cyklu (znacznik czasu podajemy z zewnątrz — testowalność). */
export function buildCycleBlob(view: CycleView, ts: number): CycleBlob {
  return {
    v: 1,
    ts,
    cycle: view.cycleName,
    src: view.source,
    vols: view.volumes.map((vol) => ({
      t: vol.title,
      cur: bit(vol.isCurrent),
      b: bit(vol.inBase),
      r: bit(vol.read),
      o: bit(vol.owned),
      a: bit(vol.awarded),
    })),
  };
}

export function serializeCycleBlob(blob: CycleBlob): string {
  return JSON.stringify(blob);
}

/** Bezpieczny parser — uszkodzony/pusty/obcy blob → null (nigdy nie rzuca). */
export function parseCycleBlob(raw?: string): CycleBlob | null {
  if (!raw || !raw.trim()) return null;
  try {
    const o = JSON.parse(raw);
    if (!o || o.v !== 1 || !Array.isArray(o.vols)) return null;
    const vols: CycleBlobVol[] = o.vols
      .filter((x: any) => x && typeof x.t === "string")
      .map((x: any) => ({
        t: x.t,
        cur: x.cur ? 1 : 0,
        b: x.b ? 1 : 0,
        r: x.r ? 1 : 0,
        o: x.o ? 1 : 0,
        a: x.a ? 1 : 0,
      }));
    return { v: 1, ts: typeof o.ts === "number" ? o.ts : 0, cycle: String(o.cycle || ""), src: o.src || "single", vols };
  } catch {
    return null;
  }
}

/**
 * Porównuje TREŚĆ dwóch blobów (nazwa cyklu + tomy ze statusami), IGNORUJĄC `ts`.
 * Dzięki temu rytuał nie przepisuje wiersza (i nie bumpuje znacznika czasu), gdy
 * struktura i statusy się nie zmieniły — mniej zapisów do Notion.
 */
export function sameCycleContent(a: CycleBlob, b: CycleBlob | null): boolean {
  if (!b) return false;
  if (a.cycle !== b.cycle || a.src !== b.src || a.vols.length !== b.vols.length) return false;
  for (let i = 0; i < a.vols.length; i++) {
    const x = a.vols[i], y = b.vols[i];
    if (x.t !== y.t || x.cur !== y.cur || x.b !== y.b || x.r !== y.r || x.o !== y.o || x.a !== y.a) return false;
  }
  return true;
}
