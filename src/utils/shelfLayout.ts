import { BookIndexEntry } from "../types";
import { ShelfSlot, spineStyle, planShelf, layoutStack, displayTitle } from "./bookshelf";
import { PackItem } from "./shelfPacking";

/** Slot do renderu: wolumin/kupka (`ShelfSlot`) albo tabliczka-przekładka sekcji. */
export type RenderSlot = ShelfSlot | { kind: "divider"; label: string };

const DIVIDER_W = 34;
const DIVIDER_H = 156;

/** Dekada roku wydania (np. 1954 → 1950); brak/niepoprawny rok → `null` (sekcja „bez daty"). */
export function decadeOf(year: string): number | null {
  const y = Number(year);
  return Number.isFinite(y) && y > 0 ? Math.floor(y / 10) * 10 : null;
}

/** Etykieta tabliczki dekady, np. „1950–1959" (albo „bez daty"). */
export function decadeLabel(dec: number | null): string {
  return dec === null ? "bez daty" : `${dec}–${dec + 9}`;
}

/**
 * Buduje `PackItem[]` (do fizyki `packAndLayout`) i mapę `slotByKey` (do renderu).
 * Woluminy przychodzą już posortowane po dacie wydania; na **granicy każdej dekady**
 * wstawiamy tabliczkę-przekładkę (`divider`). Kupki nie przekraczają granicy dekady
 * (planShelf liczony osobno per dekada). Wspólne dla wszystkich widoków regału.
 */
export function buildShelfItems(books: BookIndexEntry[]): { items: PackItem[]; slotByKey: Map<string, RenderSlot> } {
  const slotByKey = new Map<string, RenderSlot>();
  const items: PackItem[] = [];
  let i = 0;
  let divN = 0;

  while (i < books.length) {
    const dec = decadeOf(books[i].year);
    let j = i;
    while (j < books.length && decadeOf(books[j].year) === dec) j++;

    // Tabliczka na początku sekcji dekady.
    const dkey = `div:${divN++}`;
    slotByKey.set(dkey, { kind: "divider", label: decadeLabel(dec) });
    items.push({ key: dkey, kind: "divider", bw: DIVIDER_W, h: DIVIDER_H, leanDir: 0 });

    // Woluminy tej dekady (kupki/pochyły w obrębie dekady).
    for (const slot of planShelf(books.slice(i, j))) {
      if (slot.kind === "stack") {
        const key = `stack:${slot.books[0].id}`;
        slotByKey.set(key, slot);
        const sl = layoutStack(slot.books);
        items.push({ key, kind: "stack", bw: sl.cellW, h: sl.height, leanDir: 0 });
      } else {
        slotByKey.set(slot.book.id, slot);
        const st = spineStyle(slot.book);
        const stretch = Math.min(26, Math.max(8, 6 + displayTitle(slot.book).length * 0.5));
        items.push({ key: slot.book.id, kind: "spine", bw: st.width, h: st.height, leanDir: Math.sign(slot.lean) as -1 | 0 | 1, stretch });
      }
    }
    i = j;
  }
  return { items, slotByKey };
}

/** Dzieli tablicę na porcje po `size` (np. rzędy → segmenty-regały). */
export function chunk<T>(arr: T[], size: number): T[][] {
  if (size <= 0) return [arr];
  const out: T[][] = [];
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
  return out;
}
