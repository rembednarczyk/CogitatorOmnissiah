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

/** Avalanche-mix (xxHash-style) — rozprasza bity, by rozkład póz był równomierny
 *  niezależnie od korpusu tytułów (goły rolling-hash sąsiednich napisów jest skośny). */
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
 * Slot na półce — deterministyczny plan ułożenia. Każdy wolumin trafia dokładnie
 * do jednego slotu:
 * - `spine` — grzbiet stojący (prosto, `lean === 0`) lub lekko przechylony (`lean` °),
 * - `stack` — kupka LEŻĄCYCH książek; **każda warstwa to osobny, prawdziwy wolumin**
 *   (własny tytuł/kolor/nagroda/drag), a nie jeden grzbiet udający stos.
 */
export type ShelfSlot =
  | { kind: "spine"; book: BookIndexEntry; lean: number }
  | { kind: "stack"; books: BookIndexEntry[] };

export const MAX_LEAN_DEG = 6;

/**
 * Planuje sloty dla posortowanej listy woluminów. Decyzja per książka jest
 * deterministyczna (hasz tytułu); kupkę tworzy kilka KOLEJNYCH prawdziwych
 * książek (starter „pożera" następne). ~80 % stoi prosto, ~12 % lekko przechylone,
 * reszta ląduje w kupkach po 2–4 realne woluminy.
 */
export function planShelf(books: BookIndexEntry[]): ShelfSlot[] {
  const slots: ShelfSlot[] = [];
  for (let i = 0; i < books.length; ) {
    const b = books[i];
    const x = seed(b);
    const sel = x % 100;
    if (sel < 80 || books.length - i < 2) {
      slots.push({ kind: "spine", book: b, lean: 0 });
      i += 1;
    } else if (sel < 92) {
      const mag = 3 + ((x >>> 13) % (MAX_LEAN_DEG - 2)); // 3–6°
      slots.push({ kind: "spine", book: b, lean: (x >>> 3) & 1 ? mag : -mag });
      i += 1;
    } else {
      const size = Math.min(4 + ((x >>> 17) % 4), books.length - i); // 4–7 realnych książek
      slots.push({ kind: "stack", books: books.slice(i, i + size) });
      i += size;
    }
  }
  return slots;
}

/**
 * Layout przechylonego grzbietu. Reguła: **żadna książka nie nachodzi na drugą** —
 * komórka rezerwuje szerokość OBRÓCONEGO grzbietu (`cellW`), a `shiftX` przesuwa go,
 * by obrócony prostokąt był wyśrodkowany w komórce (inaczej wierzchołek wychodzi
 * jedną stroną poza tor). Dla `deg === 0` → zwykła szerokość, bez przesunięcia.
 */
export interface LeanLayout { cellW: number; shiftX: number; }

export function leanLayout(style: SpineStyle, deg: number): LeanLayout {
  if (!deg) return { cellW: style.width, shiftX: 0 };
  const rad = (Math.abs(deg) * Math.PI) / 180;
  const cellW = Math.ceil(style.width * Math.cos(rad) + style.height * Math.sin(rad)) + 1;
  const shiftX = -Math.sign(deg) * (style.height * Math.sin(rad)) / 2;
  return { cellW, shiftX };
}

// Przybliżona szerokość znaku względem rozmiaru czcionki (font bold) — celowo
// zawyżona, by CAŁY tytuł na pewno się zmieścił (bez ucinania / wielokropka).
const CHAR_W = 0.6;

/**
 * Rozmiar czcionki tytułu na STOJĄCYM grzbiecie. Tekst biegnie wzdłuż wysokości
 * grzbietu, więc dłuższy tytuł dostaje mniejszą czcionkę, tak by pełna nazwa
 * zmieściła się na całej wysokości (bez ucinania). Zakres 6–11 px.
 */
export function spineFontSize(style: SpineStyle, title: string): number {
  const len = Math.max(1, title.length);
  const f = Math.floor((style.height * 0.92) / (len * CHAR_W));
  return Math.max(6, Math.min(11, f));
}

/** Wymiary LEŻĄCEJ książki tak, by cała nazwa się zmieściła (pozioma, wzdłuż grzbietu). */
export interface FlatBookLayout { width: number; fontSize: number; thickness: number; }

/**
 * Dobiera szerokość, czcionkę i grubość leżącej książki tak, by zmieścić PEŁNY
 * tytuł: najpierw próbuje dużej czcionki, przy długich tytułach schodzi do 7 px
 * (i wtedy poszerza), a grubość rośnie lekko z czcionką (grubsza książka mieści
 * większy napis). Nic nie jest ucinane.
 */
export function flatBookLayout(book: BookIndexEntry, style: SpineStyle): FlatBookLayout {
  const len = Math.max(1, displayTitle(book).length);
  const PAD = 22;        // lewy margines tekstu + prawa krawędź kartek/nagroda
  const MAX_W = 240;     // powyżej tej szerokości wolimy zmniejszyć czcionkę
  const textW = (f: number) => Math.ceil(len * CHAR_W * f);
  let fontSize = 11;
  while (fontSize > 7 && textW(fontSize) + PAD > MAX_W) fontSize--;
  const width = Math.max(72, textW(fontSize) + PAD);
  const thickness = Math.min(24, Math.max(15, fontSize + 7));
  return { width, fontSize, thickness };
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
