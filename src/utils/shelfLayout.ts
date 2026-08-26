import { BookIndexEntry } from "../types";
import { ShelfSlot, spineStyle, planShelf, layoutStack, displayTitle, parseYear } from "./bookshelf";
import { PackItem, PlacedItem } from "./shelfPacking";

/** Render slot: a volume/pile (`ShelfSlot`) or a section divider plate. */
export type RenderSlot = ShelfSlot | { kind: "divider"; label: string };

/** The level at which the horizontal decade plate is painted: at the top (default) or at the bottom. */
export type DividerLevel = "top" | "bottom";
/** Direction the plate unfolds from the board: to the right (default) or to the left (at the right edge). */
export type DividerDir = "right" | "left";
/** Placement of the divider plate: level (top/bottom) + direction (left/right). */
export interface DividerPlacement { level: DividerLevel; dir: DividerDir; }

/** Board footprint on the shelf (px) — consistent with `DIVIDER_W` / `ShelfDivider width`. */
const PLATE_BOARD_W = 10;

/**
 * Estimated width of the horizontal year plate (px) — for collision detection.
 * Circle sigil (13) + gap (6) + padding `px-[9px]` (2×9) + text (mono 11px with
 * `letterSpacing 0.06em` ≈ 7.3 px/char). This is a heuristic, not a DOM measurement —
 * it aims to catch „narrow decades", not subpixel accuracy.
 */
export function plateWidth(label: string): number {
  return Math.ceil(37 + label.length * 7.3);
}

/**
 * Places decade plates in ONE row so they neither overlap each other nor
 * spill past the shelf:
 *  - **direction**: the plate unfolds to the right of the board; if it would reach past
 *    the right edge of the shelf (`rowWidth`), it unfolds to the left (right edge at the board);
 *  - **level**: greedily from the left — the plate stays on top as long as its horizontal
 *    span doesn't collide with the last top one; otherwise it lands on the bottom; and when
 *    the bottom is taken too (a rare triple collision) — it returns to the top (accepted).
 * Returns a map `key→{level,dir}` for EVERY divider (default `{top,right}`).
 * `rowWidth ≤ 0` (unknown width) disables edge detection — everything to the right.
 */
export function assignDividerPlacement(
  row: PlacedItem[],
  labelOf: (key: string) => string | undefined,
  rowWidth: number,
  gap = 6,
): Map<string, DividerPlacement> {
  const dividers = row.filter((p) => p.kind === "divider");
  // Direction + horizontal span [left,right] of each plate (accounts for left wrapping).
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
    else { level = "top"; topRight = s.right + gap; } // triple collision → top
    out.set(s.key, { level, dir: s.dir });
  }
  return out;
}

const DIVIDER_W = 10;   // thin board (footprint on the shelf)
const DIVIDER_H = 168;  // = BOARD_H in ShelfDivider — real support for a tilted neighbor

/** Decade of the publication year (e.g. 1954 → 1950); multi-date fields → first year; missing → `null`. */
export function decadeOf(year: string): number | null {
  const y = parseYear(year);
  return y === null ? null : Math.floor(y / 10) * 10;
}

/** Decade plate label, e.g. „1950–1959" (or „bez daty"). */
export function decadeLabel(dec: number | null): string {
  return dec === null ? "bez daty" : `${dec}–${dec + 9}`;
}

/**
 * Builds `PackItem[]` (for the `packAndLayout` physics) and the `slotByKey` map (for rendering).
 * Volumes arrive already sorted by publication date; at **each decade boundary**
 * we insert a divider (`divider`) — a thin board on the shelf with a horizontal year
 * plate on top (render: `ShelfDivider`). Piles don't cross a decade boundary
 * (planShelf computed separately per decade). Shared by all Regał views.
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

    // Plate at the start of the decade section.
    const dkey = `div:${divN++}`;
    slotByKey.set(dkey, { kind: "divider", label: decadeLabel(dec) });
    items.push({ key: dkey, kind: "divider", bw: DIVIDER_W, h: DIVIDER_H, leanDir: 0 });

    // Volumes of this decade (piles/tilts within the decade).
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

/** Splits an array into chunks of `size` (e.g. rows → shelf segments). */
export function chunk<T>(arr: T[], size: number): T[][] {
  if (size <= 0) return [arr];
  const out: T[][] = [];
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
  return out;
}
