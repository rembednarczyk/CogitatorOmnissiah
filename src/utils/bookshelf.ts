import { BookIndexEntry } from "../types";

/** Znacznik „Źródło" oznaczający pozycję przeczytaną. */
export const READ_TAG = "Przeczytane";

/** Która półka: przeczytane vs do przeczytania. */
export type ShelfId = "read" | "toRead";

/** Lokalne nadpisania stanu „przeczytane" (optymistyczny drag&drop przed potwierdzeniem z API). */
export type ReadOverrides = Record<string, boolean>;

/** Czy książka jest przeczytana — z uwzględnieniem optymistycznego nadpisania. */
export function isRead(book: BookIndexEntry, overrides: ReadOverrides = {}): boolean {
  if (Object.prototype.hasOwnProperty.call(overrides, book.id)) return overrides[book.id];
  return book.zrodlo.includes(READ_TAG);
}

/** Deterministyczny wygląd grzbietu — stały dla danego tytułu (bez migotania przy re-renderze). */
export interface SpineStyle {
  color: string;
  width: number;  // px
  height: number; // px
}

/** Paleta „płótna introligatorskiego" — stonowana, autentyczna. */
export const CLOTH_PALETTE = [
  "#7f1d2e", "#0f5132", "#1e3a5f", "#7c5410", "#3f2d52", "#2b2b2b",
  "#5a2a1e", "#14504f", "#4a3b16", "#5b1f3a", "#243b53", "#6b2737",
];

function hash(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0;
  return h;
}

export function spineStyle(book: BookIndexEntry): SpineStyle {
  const h = hash(book.plTitle || book.origTitle || book.id);
  return {
    color: CLOTH_PALETTE[h % CLOTH_PALETTE.length],
    width: 16 + (h % 12),          // 16–27 px
    height: 124 + ((h >>> 3) % 48), // 124–171 px (unsigned shift — h bywa >2^31)
  };
}

/** Tytuł do pokazania (polski, a gdy brak — oryginalny). */
export function displayTitle(book: BookIndexEntry): string {
  return book.plTitle || book.origTitle;
}

/** Czy pozycja ma nagrodę/nominację (do pieczęci na grzbiecie i półki „Wyróżnione"). */
export function hasAward(book: BookIndexEntry): boolean {
  return book.awards.length > 0;
}

const byAuthorTitle = (a: BookIndexEntry, b: BookIndexEntry) =>
  (a.author || "").localeCompare(b.author || "", "pl") || displayTitle(a).localeCompare(displayTitle(b), "pl");

/**
 * Dzieli księgozbiór na dwie półki wg stanu „przeczytane" (z nadpisaniami),
 * każda posortowana wg autora → tytułu (naturalny porządek biblioteczny).
 */
export function splitShelves(books: BookIndexEntry[], overrides: ReadOverrides = {}): Record<ShelfId, BookIndexEntry[]> {
  const read: BookIndexEntry[] = [];
  const toRead: BookIndexEntry[] = [];
  for (const b of books) (isRead(b, overrides) ? read : toRead).push(b);
  read.sort(byAuthorTitle);
  toRead.sort(byAuthorTitle);
  return { read, toRead };
}

/**
 * Półka „Wyróżnione" (okładki twarzą): przeczytane pozycje z nagrodą.
 * Brak daty przeczytania w danych → kolejność wg roku malejąco, potem tytuł.
 */
export function featuredReads(books: BookIndexEntry[], overrides: ReadOverrides = {}, limit = 12): BookIndexEntry[] {
  return books
    .filter((b) => isRead(b, overrides) && hasAward(b))
    .sort((a, b) => (Number(b.year) || 0) - (Number(a.year) || 0) || displayTitle(a).localeCompare(displayTitle(b), "pl"))
    .slice(0, limit);
}
