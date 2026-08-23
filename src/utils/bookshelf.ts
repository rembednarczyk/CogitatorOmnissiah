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

/**
 * Poza grzbietu na półce — deterministyczna (z hasza tytułu), by regał miał
 * trochę dynamiki, ale nie migotał przy re-renderze / zawijaniu wierszy.
 * - `straight` — stoi prosto (większość),
 * - `lean` — przechylony o `deg` stopni, jakby oparty o sąsiada (pivot u podstawy),
 * - `flat` — leży na płask jako mały stosik (`layers` książek, szerokość `w`).
 */
export type SpinePose =
  | { kind: "straight" }
  | { kind: "lean"; deg: number }
  | { kind: "flat"; w: number; layers: number };

/** Avalanche-mix (xxHash-style) — rozprasza bity, by rozkład póz był równomierny
 *  niezależnie od korpusu tytułów (goły rolling-hash sąsiednich napisów jest skośny). */
function mix32(n: number): number {
  let x = n >>> 0;
  x ^= x >>> 16; x = Math.imul(x, 0x7feb352d);
  x ^= x >>> 15; x = Math.imul(x, 0x846ca68b);
  x ^= x >>> 16;
  return x >>> 0;
}

export function spinePose(book: BookIndexEntry): SpinePose {
  const x = mix32(hash(book.plTitle || book.origTitle || book.id));
  const sel = x % 100;                          // ~66% prosto, ~27% przechył, ~7% leżą
  if (sel < 66) return { kind: "straight" };
  if (sel < 93) {
    const mag = 4 + ((x >>> 13) % 8);          // 4–11°
    return { kind: "lean", deg: (x >>> 3) & 1 ? mag : -mag };
  }
  return {
    kind: "flat",
    w: 74 + ((x >>> 17) % 46),                 // 74–119 px (szerokość leżącej książki)
    layers: 3 + ((x >>> 23) % 3),              // 3–5 książek w stosiku
  };
}

/**
 * Layout komórki grzbietu na półce. Reguła: **żadna książka nie nachodzi na drugą** —
 * komórka rezerwuje dokładnie tyle szerokości, ile zajmuje obrócony grzbiet
 * (`cellW`), a `shiftX` przesuwa go tak, by obrócony prostokąt był wyśrodkowany
 * w komórce. Dzięki temu przechylony wolumin mieści się w swoim torze i nie
 * dotyka sąsiadów (między komórkami zostaje `column-gap`).
 */
export interface SpineLayout {
  cellW: number;   // szerokość komórki (flex-item), px
  shiftX: number;  // przesunięcie poziome grzbietu, px (centrowanie obróconego bboxa)
  rotate: number;  // kąt obrotu, ° (0 = prosto)
}

export function spineLayout(style: SpineStyle, pose: SpinePose): SpineLayout {
  if (pose.kind === "flat") return { cellW: pose.w, shiftX: 0, rotate: 0 };
  if (pose.kind === "lean") {
    const rad = (Math.abs(pose.deg) * Math.PI) / 180;
    const cellW = Math.ceil(style.width * Math.cos(rad) + style.height * Math.sin(rad)) + 1;
    const shiftX = -Math.sign(pose.deg) * (style.height * Math.sin(rad)) / 2;
    return { cellW, shiftX, rotate: pose.deg };
  }
  return { cellW: style.width, shiftX: 0, rotate: 0 };
}

/** Tytuł do pokazania (polski, a gdy brak — oryginalny). */
export function displayTitle(book: BookIndexEntry): string {
  return book.plTitle || book.origTitle;
}

// ─── Geometria regału (deski) ─────────────────────────────────────────────
// Rzędy grzbietów mają STAŁĄ wysokość, dzięki czemu każdy zawinięty wiersz
// zaczyna się na tej samej wysokości i można pod nim narysować drewnianą deskę
// jednym powtarzalnym gradientem — niezależnie od szerokości ekranu i liczby
// książek w wierszu. `ROW_H` > najwyższy grzbiet (171 px), `GAP` mieści deskę.
export const SHELF_ROW_H = 178;   // px — wysokość toru jednego rzędu
export const SHELF_PLANK_H = 15;  // px — grubość widocznej deski
export const SHELF_ROW_GAP = 30;  // px — prześwit pod rzędem (deska + cień + luz)

/**
 * Tło powtarzalne rysujące drewnianą deskę tuż pod spodem każdego rzędu grzbietów.
 * Grzbiety są wyrównane do dołu toru `SHELF_ROW_H`, więc deska ląduje dokładnie
 * pod nimi (w prześwicie `SHELF_ROW_GAP`). Zwraca gotowy `background` (CSS).
 */
export function shelfPlankBackground(): { backgroundImage: string } {
  const top = SHELF_ROW_H;                        // górna krawędź deski (linia książek)
  const bot = SHELF_ROW_H + SHELF_PLANK_H;        // dolna krawędź deski
  const period = SHELF_ROW_H + SHELF_ROW_GAP;     // skok pionowy na jeden rząd
  const backgroundImage =
    `repeating-linear-gradient(180deg,` +
    ` rgba(0,0,0,0) 0px,` +
    ` rgba(0,0,0,0) ${top}px,` +
    ` rgba(255,214,160,0.45) ${top}px,` +          // rozświetlona krawędź (blat)
    ` #5a3a1e ${top + 1}px,` +                      // drewno — góra
    ` #3a2413 ${top + Math.round(SHELF_PLANK_H * 0.55)}px,` +
    ` #1c1108 ${bot - 1}px,` +                      // drewno — dół
    ` rgba(0,0,0,0.85) ${bot}px,` +                 // cień rzucany pod deską
    ` rgba(0,0,0,0) ${bot + 6}px,` +
    ` rgba(0,0,0,0) ${period}px)`;
  return { backgroundImage };
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
