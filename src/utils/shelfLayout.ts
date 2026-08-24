import { BookIndexEntry } from "../types";
import { ShelfSlot, spineStyle, planShelf, layoutStack, displayTitle } from "./bookshelf";
import { PackItem } from "./shelfPacking";

/**
 * Buduje `PackItem[]` (do fizyki `packAndLayout`) i mapę `slotByKey` (do renderu)
 * dla listy woluminów. Wspólne dla pojedynczego regału i regałów w pokoju.
 */
export function buildShelfItems(books: BookIndexEntry[]): { items: PackItem[]; slotByKey: Map<string, ShelfSlot> } {
  const slots = planShelf(books);
  const slotByKey = new Map<string, ShelfSlot>();
  const items: PackItem[] = slots.map((slot) => {
    if (slot.kind === "stack") {
      const key = `stack:${slot.books[0].id}`;
      slotByKey.set(key, slot);
      const sl = layoutStack(slot.books);
      return { key, kind: "stack", bw: sl.cellW, h: sl.height, leanDir: 0 };
    }
    slotByKey.set(slot.book.id, slot);
    const st = spineStyle(slot.book);
    // Dłuższy tytuł → grzbiet może zgrubieć bardziej (naturalnie „grubsza książka").
    const stretch = Math.min(26, Math.max(8, 6 + displayTitle(slot.book).length * 0.5));
    return { key: slot.book.id, kind: "spine", bw: st.width, h: st.height, leanDir: Math.sign(slot.lean) as -1 | 0 | 1, stretch };
  });
  return { items, slotByKey };
}

/** Dzieli tablicę na porcje po `size` (np. rzędy → segmenty-regały). */
export function chunk<T>(arr: T[], size: number): T[][] {
  if (size <= 0) return [arr];
  const out: T[][] = [];
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
  return out;
}
