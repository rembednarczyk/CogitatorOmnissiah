import { BookIndexEntry } from "../types";

/** „Źródło" tag marking an item as read. */
export const READ_TAG = "Przeczytane";

/** Which shelf: read vs to-read. */
export type ShelfId = "read" | "toRead";

/** Local overrides of the „przeczytane" state (optimistic drag&drop before API confirmation). */
export type ReadOverrides = Record<string, boolean>;

/** Whether the book is read — taking optimistic overrides into account. */
export function isRead(book: BookIndexEntry, overrides: ReadOverrides = {}): boolean {
  if (Object.prototype.hasOwnProperty.call(overrides, book.id)) return overrides[book.id];
  return book.zrodlo.includes(READ_TAG);
}

/** Deterministic spine appearance — stable per title (no flicker on re-render). */
export interface SpineStyle {
  color: string;   // muted bookbinding-cloth color (Klasyczny skin, dark)
  light: string;   // lighter boho color (light „Librem" theme) — mockup palette
  app: string;     // accent from the app palette (Holo+ skin) — hex
  appRgb: string;  // the same accent as „r,g,b" (for rgba(var(...), a))
  width: number;   // px
  height: number;  // px
}

/** Bookbinding-cloth palette — muted, authentic (Klasyczny / dark). */
export const CLOTH_PALETTE = [
  "#7f1d2e", "#0f5132", "#1e3a5f", "#7c5410", "#3f2d52", "#2b2b2b",
  "#5a2a1e", "#14504f", "#4a3b16", "#5b1f3a", "#243b53", "#6b2737",
];

/** Light boho spine palette (jasny motyw „Librem") — jaśniejsze grzbiety w
 *  paletcie makiety: clay/sage/ochre/brick + ciepłe tany. Parallel to
 *  `CLOTH_PALETTE` (same index = same book). Mid-tone, żeby kremowy tytuł
 *  na grzbiecie był czytelny. */
export const LIGHT_SPINE_PALETTE = [
  "#B0574A", "#7E8A6B", "#C4933A", "#A9603D", "#9C7B52", "#6F7A58",
  "#B8623F", "#CF9B3F", "#8A6B46", "#A5524A", "#8F8560", "#C07A56",
];

/** App accent palette (cyan/blue/indigo/violet/purple) — Holo+.
 *  Parallel to `CLOTH_PALETTE` (same index = same book). */
export const APP_PALETTE: readonly (readonly [string, string])[] = [
  ["#06b6d4", "6,182,212"], ["#3b82f6", "59,130,246"], ["#6366f1", "99,102,241"], ["#8b5cf6", "139,92,246"],
  ["#a855f7", "168,85,247"], ["#14b8a6", "20,184,166"], ["#0ea5e9", "14,165,233"], ["#4f46e5", "79,70,229"],
  ["#7c3aed", "124,58,237"], ["#0891b2", "8,145,178"], ["#2563eb", "37,99,235"], ["#9333ea", "147,51,234"],
];

function hash(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0;
  return h;
}

export function spineStyle(book: BookIndexEntry): SpineStyle {
  const h = hash(book.plTitle || book.origTitle || book.id);
  const idx = h % CLOTH_PALETTE.length;
  const [app, appRgb] = APP_PALETTE[idx];
  return {
    color: CLOTH_PALETTE[idx],
    light: LIGHT_SPINE_PALETTE[idx],
    app, appRgb,
    width: 16 + (h % 12),          // 16–27 px
    height: 124 + ((h >>> 3) % 48), // 124–171 px (unsigned shift — h can be >2^31)
  };
}

/** Avalanche-mix (xxHash-style) — scrambles bits so the pose distribution is even
 *  regardless of the title corpus (a bare rolling-hash of adjacent strings is skewed). */
function mix32(n: number): number {
  let x = n >>> 0;
  x ^= x >>> 16; x = Math.imul(x, 0x7feb352d);
  x ^= x >>> 15; x = Math.imul(x, 0x846ca68b);
  x ^= x >>> 16;
  return x >>> 0;
}

function seed(book: BookIndexEntry): number {
  return mix32(hash(book.plTitle || book.origTitle || book.id));
}

/**
 * A shelf slot — a deterministic layout plan. Each volume lands in exactly
 * one slot:
 * - `spine` — a standing spine (upright, `lean === 0`) or slightly tilted (`lean` °),
 * - `stack` — a pile of LYING books; **each layer is a separate, real volume**
 *   (its own title/color/award/drag), not one spine pretending to be a stack.
 */
export type ShelfSlot =
  | { kind: "spine"; book: BookIndexEntry; lean: number }
  | { kind: "stack"; books: BookIndexEntry[] };

export const MAX_LEAN_DEG = 6;

/**
 * Plans slots for a sorted list of volumes. The per-book decision is
 * deterministic (title hash); a pile is formed by several CONSECUTIVE real
 * books (the starter swallows the ones that follow). The vast majority stand
 * upright, ~12 % slightly tilted, and piles (of 4–7 real volumes) are rare.
 *
 * Layout rules:
 * - **two piles never sit adjacent** (after a pile the next slot is always a spine),
 * - **spines adjacent to a pile tilt toward it** (`LEAN_TOWARD`).
 */
export const LEAN_TOWARD = 5;

export function planShelf(books: BookIndexEntry[]): ShelfSlot[] {
  const slots: ShelfSlot[] = [];
  let prevWasStack = false;
  for (let i = 0; i < books.length; ) {
    const b = books[i];
    const x = seed(b);
    const sel = x % 100;
    // Pile only when: the draw hit (rarely), there are ≥2 books and the previous slot was NOT a pile.
    if (sel >= 95 && books.length - i >= 2 && !prevWasStack) {
      const size = Math.min(4 + ((x >>> 17) % 4), books.length - i); // 4–7 real books
      slots.push({ kind: "stack", books: books.slice(i, i + size) });
      i += size;
      prevWasStack = true;
    } else if (sel >= 80 && sel < 92) {
      const mag = 3 + ((x >>> 13) % (MAX_LEAN_DEG - 2)); // 3–6°
      slots.push({ kind: "spine", book: b, lean: (x >>> 3) & 1 ? mag : -mag });
      i += 1;
      prevWasStack = false;
    } else {
      // upright (a blocked pile also falls here)
      slots.push({ kind: "spine", book: b, lean: 0 });
      i += 1;
      prevWasStack = false;
    }
  }

  // Spines right next to a pile tilt toward it (overrides the random pose).
  // A pile's neighbor is always a spine (two piles don't sit adjacent). The spine's
  // top tilts inward: left neighbor to the right (+), right neighbor to the left (−).
  for (let k = 0; k < slots.length; k++) {
    if (slots[k].kind !== "stack") continue;
    const left = slots[k - 1], right = slots[k + 1];
    if (left && left.kind === "spine") left.lean = LEAN_TOWARD;
    if (right && right.kind === "spine") right.lean = -LEAN_TOWARD;
  }
  return slots;
}

// Approximate character width relative to font size (bold font) — deliberately
// overestimated so the WHOLE title definitely fits (no truncation / ellipsis).
const CHAR_W = 0.6;

/**
 * Title font size on a STANDING spine. The text runs along the spine's height,
 * so a longer title gets a smaller font, so that the full name fits across the
 * whole height (no truncation). Range 6–11 px.
 */
export function spineFontSize(style: SpineStyle, title: string): number {
  const len = Math.max(1, title.length);
  const f = Math.floor((style.height * 0.92) / (len * CHAR_W));
  return Math.max(6, Math.min(11, f));
}

/** Dimensions of a LYING book so the whole name fits (horizontal, along the spine). */
export interface FlatBookLayout { width: number; fontSize: number; thickness: number; lines: 1 | 2 }

/** Upper width limit for a lying book — above it we WRAP the title to 2 lines. */
export const FLAT_MAX_W = 150;

/**
 * Picks width, font, thickness and line count of a lying book so as to fit
 * the FULL title WITHOUT widening past `FLAT_MAX_W`: a short title → 1 line
 * (book exactly as wide as the text), longer → 2 lines (book a bit thicker,
 * not wider). A very long title additionally shrinks the font until half fits
 * in one line (2 lines always suffice). Nothing is truncated.
 */
export function flatBookLayout(book: BookIndexEntry): FlatBookLayout {
  const len = Math.max(1, displayTitle(book).length);
  const PAD_X = 20;                       // left text margin + right edge of the pages
  const availW = FLAT_MAX_W - PAD_X;
  const oneLine = (f: number) => len * CHAR_W * f;

  let fontSize = 10;
  let lines: 1 | 2 = 1;
  let width: number;
  if (oneLine(fontSize) <= availW) {
    width = Math.max(72, Math.ceil(oneLine(fontSize)) + PAD_X);
  } else {
    lines = 2;
    width = FLAT_MAX_W;
    while (fontSize > 7 && Math.ceil(oneLine(fontSize) / 2) > availW) fontSize--;
  }
  const lineH = fontSize + 1;
  const thickness = Math.min(24, Math.max(15, lines * lineH + 4));
  return { width, fontSize, thickness, lines };
}

// ─── Pile layout ───────────────────────────────────────────────────────
export type StackAlign = "left" | "right" | "center";

function stackSeed(books: BookIndexEntry[]): number {
  return mix32((seed(books[0]) ^ Math.imul(books.length, 0x9e3779b1)) >>> 0);
}

/**
 * Pile alignment: **often left, often right, VERY RARELY a symmetric
 * pyramid** (center). Deterministic from the first book + pile size.
 */
export function stackAlign(books: BookIndexEntry[]): StackAlign {
  const s = stackSeed(books) % 100;
  if (s < 45) return "left";
  if (s < 90) return "right";
  return "center"; // ~10 %
}

/** Layout „chaos" level in px: 0 = even, ~⅓ of piles get 3–7 px of spread. */
export function stackChaos(books: BookIndexEntry[]): number {
  const s = mix32(stackSeed(books) ^ 0x85ebca6b);
  return (s % 100) < 34 ? 3 + (s % 5) : 0;
}

/** Deterministic slack of a single book in a pile, normalized to [-1, 1). */
export function layerJitter(book: BookIndexEntry): number {
  const s = mix32(seed(book) ^ 0xc2b2ae35);
  return ((s % 1000) / 500) - 1;
}

export interface StackLayoutLayer extends FlatBookLayout { book: BookIndexEntry; x: number }
export interface StackLayout { cellW: number; height: number; align: StackAlign; chaos: number; layers: StackLayoutLayer[] }

/**
 * Full pile layout: sorts books **from largest (bottom) to smallest
 * (top)**, picks alignment (`stackAlign`) and chaos level (`stackChaos`),
 * and computes the horizontal offset `x` of each layer. Guarantee: `0 ≤ x ≤ cellW − width`
 * (nothing sticks out of the cell → no overlap onto adjacent slots).
 * `layers[0]` is the bottom of the pile (render via `flex-col-reverse`).
 */
export function layoutStack(books: BookIndexEntry[]): StackLayout {
  const align = stackAlign(books);
  const chaos = stackChaos(books);
  const sorted = books
    .map((b) => ({ book: b, ...flatBookLayout(b) }))
    .sort((a, b) => b.width - a.width || b.thickness - a.thickness || a.book.id.localeCompare(b.book.id));
  const maxW = Math.max(...sorted.map((l) => l.width));
  const cellW = maxW + 2 * chaos;
  const layers = sorted.map((l) => {
    const slack = cellW - l.width;
    let x = align === "left" ? chaos : align === "right" ? slack - chaos : slack / 2;
    x += layerJitter(l.book) * chaos;
    x = Math.max(0, Math.min(slack, x));
    return { ...l, x };
  });
  // Pile height: sum of layer thicknesses + 1 px margin between them.
  const height = layers.reduce((s, l) => s + l.thickness, 0) + Math.max(0, layers.length - 1);
  return { cellW, height, align, chaos, layers };
}

/** Title to display (Polish, and when missing — original). */
export function displayTitle(book: BookIndexEntry): string {
  return book.plTitle || book.origTitle;
}

// ─── Regał geometry (planks) ─────────────────────────────────────────────
// Spine rows have a FIXED height, so every wrapped line starts at the same
// height and a wooden plank can be drawn under it with a single repeating
// gradient — regardless of screen width and the number of books in a line.
// `ROW_H` > tallest spine (171 px), `GAP` fits the plank.
export const SHELF_ROW_H = 178;   // px — height of one row's track
export const SHELF_PLANK_H = 15;  // px — thickness of the visible plank
export const SHELF_ROW_GAP = 30;  // px — gap under the row (plank + shadow + slack)

/**
 * A repeating background drawing a wooden plank just beneath each row of spines.
 * Spines are aligned to the bottom of the `SHELF_ROW_H` track, so the plank lands
 * exactly under them (in the `SHELF_ROW_GAP` gap). Returns a ready `background` (CSS).
 */
export function shelfPlankBackground(): { backgroundImage: string } {
  const top = SHELF_ROW_H;                        // top edge of the plank (book line)
  const bot = SHELF_ROW_H + SHELF_PLANK_H;        // bottom edge of the plank
  const period = SHELF_ROW_H + SHELF_ROW_GAP;     // vertical step per row
  const backgroundImage =
    `repeating-linear-gradient(180deg,` +
    ` rgba(0,0,0,0) 0px,` +
    ` rgba(0,0,0,0) ${top}px,` +
    ` rgba(255,214,160,0.45) ${top}px,` +          // lit edge (top surface)
    ` #5a3a1e ${top + 1}px,` +                      // wood — top
    ` #3a2413 ${top + Math.round(SHELF_PLANK_H * 0.55)}px,` +
    ` #1c1108 ${bot - 1}px,` +                      // wood — bottom
    ` rgba(0,0,0,0.85) ${bot}px,` +                 // shadow cast under the plank
    ` rgba(0,0,0,0) ${bot + 6}px,` +
    ` rgba(0,0,0,0) ${period}px)`;
  return { backgroundImage };
}

/** Marker of a WON award (not a nomination) with a color-code for the spine seal. */
export interface AwardMark { key: "hugo" | "nebula" | "locus"; color: string; label: string }

const AWARD_MARKS: Record<AwardMark["key"], AwardMark> = {
  hugo: { key: "hugo", color: "#fbbf24", label: "Hugo" },      // gold (rocket)
  nebula: { key: "nebula", color: "#c084fc", label: "Nebula" }, // violet (nebula)
  locus: { key: "locus", color: "#38bdf8", label: "Locus" },   // blue
};

/**
 * A book's won awards with a color-code. Takes ONLY wins („Nagroda …" or
 * „Wszystkie" = Hugo+Nebula+Locus) — **nominations are skipped**. Deduplicated,
 * in a fixed order Hugo → Nebula → Locus.
 */
export function awardWins(book: BookIndexEntry): AwardMark[] {
  const won = new Set<AwardMark["key"]>();
  for (const a of book.awards) {
    const s = a.toLowerCase().trim();
    if (s === "wszystkie") { won.add("hugo"); won.add("nebula"); won.add("locus"); continue; }
    if (!s.startsWith("nagroda ")) continue;        // skip „Nominacja …" and others
    if (s.includes("hugo")) won.add("hugo");
    else if (s.includes("nebula")) won.add("nebula");
    else if (s.includes("locus")) won.add("locus");
  }
  return (["hugo", "nebula", "locus"] as const).filter((k) => won.has(k)).map((k) => AWARD_MARKS[k]);
}

/** Whether the item has a won award (for the spine seal and the „Wyróżnione" shelf). */
export function hasAward(book: BookIndexEntry): boolean {
  return awardWins(book).length > 0;
}

/**
 * Publication year from the date field. The field is sometimes multi-valued
 * („1965/1966", „1965, 1966", „1965 (wyd. pol. 1970)") — we take **the first
 * 4-digit year from the edge**, so the item still lands in its decade. No year → `null`.
 */
export function parseYear(year: string): number | null {
  const m = String(year ?? "").match(/\d{4}/);
  const y = m ? Number(m[0]) : NaN;
  return Number.isFinite(y) && y > 0 ? y : null;
}

/** Publication year as a number for sorting; missing → at the end. */
export function pubYear(b: BookIndexEntry): number {
  return parseYear(b.year) ?? Infinity;
}

/** Book's decade key (1950, 1960, …); no year → Infinity („bez daty" section at the end). */
export function decadeKeyOf(b: BookIndexEntry): number {
  const y = parseYear(b.year);
  return y === null ? Infinity : Math.floor(y / 10) * 10;
}

/**
 * Effective shelf-ordering key: the manual `shelfOrder` (precise drag&drop),
 * as long as it falls within the book's decade — a key outside the decade is STALE
 * (the book's year changed decade after the key was assigned) and falls back to
 * sorting by year. Scale: fractional years.
 */
export function effShelfKey(b: BookIndexEntry): number {
  const dec = decadeKeyOf(b);
  const so = b.shelfOrder;
  if (typeof so === "number" && isFinite(so) && isFinite(dec) && so >= dec && so < dec + 10) return so;
  return pubYear(b);
}

/**
 * Order on the Regał: decade → effective key (manual or year) → title.
 * Without manual keys, equivalent to the old sort by year (decade grows with year).
 */
export const byShelfPosition = (a: BookIndexEntry, b: BookIndexEntry) =>
  decadeKeyOf(a) - decadeKeyOf(b) || effShelfKey(a) - effShelfKey(b) || displayTitle(a).localeCompare(displayTitle(b), "pl");

/**
 * Splits the collection into two shelves by „przeczytane" state (with overrides),
 * each sorted in Regał order (`byShelfPosition`).
 */
export function splitShelves(books: BookIndexEntry[], overrides: ReadOverrides = {}): Record<ShelfId, BookIndexEntry[]> {
  const read: BookIndexEntry[] = [];
  const toRead: BookIndexEntry[] = [];
  for (const b of books) (isRead(b, overrides) ? read : toRead).push(b);
  read.sort(byShelfPosition);
  toRead.sort(byShelfPosition);
  return { read, toRead };
}

/**
 * The „Wyróżnione" shelf (covers facing out): read items with an award.
 * No read-date in the data → order by year descending, then title.
 */
export function featuredReads(books: BookIndexEntry[], overrides: ReadOverrides = {}, limit = 12): BookIndexEntry[] {
  return books
    .filter((b) => isRead(b, overrides) && hasAward(b))
    .sort((a, b) => (Number(b.year) || 0) - (Number(a.year) || 0) || displayTitle(a).localeCompare(displayTitle(b), "pl"))
    .slice(0, limit);
}
