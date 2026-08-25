import { BookIndexEntry } from "../types";
import { ShelfSlot, spineStyle, planShelf, layoutStack, displayTitle, parseYear } from "./bookshelf";
import { PackItem, PlacedItem } from "./shelfPacking";

/** Slot do renderu: wolumin/kupka (`ShelfSlot`) albo tabliczka-przekładka sekcji. */
export type RenderSlot = ShelfSlot | { kind: "divider"; label: string };

/** Poziom, na którym maluje się pozioma tabliczka dekady: u góry (domyślnie) albo u dołu. */
export type DividerLevel = "top" | "bottom";
/** Kierunek rozwijania tabliczki od deseczki: w prawo (domyślnie) albo w lewo (przy prawej krawędzi). */
export type DividerDir = "right" | "left";
/** Rozmieszczenie tabliczki przekładki: poziom (góra/dół) + kierunek (lewo/prawo). */
export interface DividerPlacement { level: DividerLevel; dir: DividerDir; }

/** Footprint deseczki na półce (px) — spójny z `DIVIDER_W` / `ShelfDivider width`. */
const PLATE_BOARD_W = 10;

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
 * Rozmieszcza tabliczki dekad w JEDNYM rzędzie, tak by nie nachodziły na siebie ani
 * nie wychodziły poza półkę:
 *  - **kierunek**: tabliczka rozwija się w prawo od deseczki; jeśli sięgnęłaby poza
 *    prawą krawędź półki (`rowWidth`), rozwija się w lewo (prawy brzeg przy deseczce);
 *  - **poziom**: zachłannie od lewej — tabliczka zostaje na górze, o ile jej przedział
 *    poziomy nie zderza się z ostatnią górną; inaczej ląduje na dole; a gdy i dół zajęty
 *    (rzadka potrójna kolizja) — wraca na górę (akceptujemy).
 * Zwraca mapę `key→{level,dir}` dla KAŻDEJ przekładki (domyślnie `{top,right}`).
 * `rowWidth ≤ 0` (nieznana szerokość) wyłącza detekcję krawędzi — wszystko w prawo.
 */
export function assignDividerPlacement(
  row: PlacedItem[],
  labelOf: (key: string) => string | undefined,
  rowWidth: number,
  gap = 6,
): Map<string, DividerPlacement> {
  const dividers = row.filter((p) => p.kind === "divider");
  // Kierunek + przedział poziomy [left,right] każdej tabliczki (uwzględnia zawinięcie w lewo).
  const spans = dividers.map((d) => {
    const w = plateWidth(labelOf(d.key) ?? "");
    const overflow = rowWidth > 0 && d.x + w > rowWidth;
    const right = overflow ? d.x + PLATE_BOARD_W : d.x + w;
    return { key: d.key, left: right - w, right, dir: (overflow ? "left" : "right") as DividerDir };
  });
  spans.sort((a, b) => a.left - b.left);

  const out = new Map<string, DividerPlacement>();
  let topRight = -Infinity;
  let botRight = -Infinity;
  for (const s of spans) {
    let level: DividerLevel;
    if (s.left >= topRight) { level = "top"; topRight = s.right + gap; }
    else if (s.left >= botRight) { level = "bottom"; botRight = s.right + gap; }
    else { level = "top"; topRight = s.right + gap; } // potrójna kolizja → góra
    out.set(s.key, { level, dir: s.dir });
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
