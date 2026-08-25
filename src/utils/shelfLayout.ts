import { BookIndexEntry } from "../types";
import { ShelfSlot, spineStyle, planShelf, layoutStack, displayTitle, parseYear } from "./bookshelf";
import { PackItem, PlacedItem } from "./shelfPacking";

/** Slot do renderu: wolumin/kupka (`ShelfSlot`) albo tabliczka-przekładka sekcji. */
export type RenderSlot = ShelfSlot | { kind: "divider"; label: string };

/** Poziom, na którym maluje się pozioma tabliczka dekady: u góry (domyślnie) albo u dołu. */
export type DividerLevel = "top" | "bottom";

/**
 * Estymowana szerokość poziomej tabliczki rocznika (px) — do wykrywania kolizji.
 * Sygil koła (13) + gap (6) + padding `px-[9px]` (2×9) + tekst (mono 11px z
 * `letterSpacing 0.06em` ≈ 7.3 px/znak). To heurystyka, nie pomiar DOM — celuje
 * w wykrycie „wąskich dekad", nie w subpikselową dokładność.
 */
export function plateWidth(label: string): number {
  return Math.ceil(37 + label.length * 7.3);
}

/**
 * Rozdziela tabliczki dekad w JEDNYM rzędzie na dwa poziomy (góra/dół), tak by
 * sąsiednie nie nachodziły na siebie, gdy dekada jest wąska (mało książek → następna
 * przekładka blisko). Zachłannie od lewej: tabliczka zostaje na górze, jeśli nie
 * zderza się z prawą krawędzią ostatniej górnej; inaczej ląduje na dole; a gdy i dół
 * zajęty (rzadka potrójna kolizja) — wraca na górę (akceptujemy). Zwraca mapę
 * `key→poziom` TYLKO dla przekładek, które muszą zjechać na dół (reszta = góra).
 */
export function assignDividerLevels(
  row: PlacedItem[],
  labelOf: (key: string) => string | undefined,
  gap = 6,
): Map<string, DividerLevel> {
  const dividers = row.filter((p) => p.kind === "divider").sort((a, b) => a.x - b.x);
  const out = new Map<string, DividerLevel>();
  let topRight = -Infinity;
  let botRight = -Infinity;
  for (const d of dividers) {
    const right = d.x + plateWidth(labelOf(d.key) ?? "");
    if (d.x >= topRight) {
      topRight = right + gap;               // góra (domyślna) — nie zapisujemy
    } else if (d.x >= botRight) {
      out.set(d.key, "bottom");
      botRight = right + gap;
    } else {
      topRight = right + gap;               // potrójna kolizja → góra
    }
  }
  return out;
}

const DIVIDER_W = 10;   // cienka deseczka (footprint na półce)
const DIVIDER_H = 168;  // = BOARD_H w ShelfDivider — realna podpora dla pochyłego sąsiada

/** Dekada roku wydania (np. 1954 → 1950); pola wielodatowe → pierwszy rok; brak → `null`. */
export function decadeOf(year: string): number | null {
  const y = parseYear(year);
  return y === null ? null : Math.floor(y / 10) * 10;
}

/** Etykieta tabliczki dekady, np. „1950–1959" (albo „bez daty"). */
export function decadeLabel(dec: number | null): string {
  return dec === null ? "bez daty" : `${dec}–${dec + 9}`;
}

/**
 * Buduje `PackItem[]` (do fizyki `packAndLayout`) i mapę `slotByKey` (do renderu).
 * Woluminy przychodzą już posortowane po dacie wydania; na **granicy każdej dekady**
 * wstawiamy przekładkę (`divider`) — cienką deseczkę na półce z poziomą tabliczką
 * rocznika u góry (render: `ShelfDivider`). Kupki nie przekraczają granicy dekady
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
