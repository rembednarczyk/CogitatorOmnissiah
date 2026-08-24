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
 * książek (starter „pożera" następne). Zdecydowana większość stoi prosto,
 * ~12 % lekko przechylone, a kupki (po 4–7 realnych woluminów) są rzadkie.
 *
 * Reguły ułożenia:
 * - **dwie kupki nigdy nie sąsiadują** (po kupce następny slot to zawsze grzbiet),
 * - **grzbiety sąsiadujące z kupką przechylają się w jej stronę** (`LEAN_TOWARD`).
 */
export const LEAN_TOWARD = 5;

export function planShelf(books: BookIndexEntry[]): ShelfSlot[] {
  const slots: ShelfSlot[] = [];
  let prevWasStack = false;
  for (let i = 0; i < books.length; ) {
    const b = books[i];
    const x = seed(b);
    const sel = x % 100;
    // Kupka tylko gdy: los trafił (rzadko), są ≥2 książki i poprzedni slot NIE był kupką.
    if (sel >= 95 && books.length - i >= 2 && !prevWasStack) {
      const size = Math.min(4 + ((x >>> 17) % 4), books.length - i); // 4–7 realnych książek
      slots.push({ kind: "stack", books: books.slice(i, i + size) });
      i += size;
      prevWasStack = true;
    } else if (sel >= 80 && sel < 92) {
      const mag = 3 + ((x >>> 13) % (MAX_LEAN_DEG - 2)); // 3–6°
      slots.push({ kind: "spine", book: b, lean: (x >>> 3) & 1 ? mag : -mag });
      i += 1;
      prevWasStack = false;
    } else {
      // prosto (także zablokowana kupka spada tutaj)
      slots.push({ kind: "spine", book: b, lean: 0 });
      i += 1;
      prevWasStack = false;
    }
  }

  // Grzbiety tuż obok kupki przechylają się w jej stronę (nadpisuje losową pozę).
  // Sąsiad kupki jest zawsze grzbitem (dwie kupki nie sąsiadują). Wierzch grzbietu
  // pochyla się do środka: lewy sąsiad w prawo (+), prawy sąsiad w lewo (−).
  for (let k = 0; k < slots.length; k++) {
    if (slots[k].kind !== "stack") continue;
    const left = slots[k - 1], right = slots[k + 1];
    if (left && left.kind === "spine") left.lean = LEAN_TOWARD;
    if (right && right.kind === "spine") right.lean = -LEAN_TOWARD;
  }
  return slots;
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
export interface FlatBookLayout { width: number; fontSize: number; thickness: number; lines: 1 | 2 }

/** Górny limit szerokości leżącej książki — powyżej niego tytuł ZAWIJAMY do 2 linii. */
export const FLAT_MAX_W = 150;

/**
 * Dobiera szerokość, czcionkę, grubość i liczbę linii leżącej książki tak, by
 * zmieścić PEŁNY tytuł BEZ poszerzania ponad `FLAT_MAX_W`: krótki tytuł → 1 linia
 * (książka dokładnie na tekst), dłuższy → 2 linie (książka trochę grubsza, nie
 * szersza). Bardzo długi tytuł dodatkowo zmniejsza czcionkę, aż połowa zmieści
 * się w jednej linii (2 linie zawsze wystarczą). Nic nie jest ucinane.
 */
export function flatBookLayout(book: BookIndexEntry): FlatBookLayout {
  const len = Math.max(1, displayTitle(book).length);
  const PAD_X = 20;                       // lewy margines tekstu + prawa krawędź kartek
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

// ─── Ułożenie kupki ───────────────────────────────────────────────────────
export type StackAlign = "left" | "right" | "center";

function stackSeed(books: BookIndexEntry[]): number {
  return mix32((seed(books[0]) ^ Math.imul(books.length, 0x9e3779b1)) >>> 0);
}

/**
 * Wyrównanie kupki: **często do lewej, często do prawej, BARDZO RZADKO symetryczna
 * piramida** (center). Deterministyczne z pierwszej książki + rozmiaru kupki.
 */
export function stackAlign(books: BookIndexEntry[]): StackAlign {
  const s = stackSeed(books) % 100;
  if (s < 45) return "left";
  if (s < 90) return "right";
  return "center"; // ~10 %
}

/** Poziom „chaosu" ułożenia w px: 0 = równo, ~⅓ kupek dostaje 3–7 px rozjazdu. */
export function stackChaos(books: BookIndexEntry[]): number {
  const s = mix32(stackSeed(books) ^ 0x85ebca6b);
  return (s % 100) < 34 ? 3 + (s % 5) : 0;
}

/** Deterministyczny luz pojedynczej książki w kupce, znormalizowany do [-1, 1). */
export function layerJitter(book: BookIndexEntry): number {
  const s = mix32(seed(book) ^ 0xc2b2ae35);
  return ((s % 1000) / 500) - 1;
}

export interface StackLayoutLayer extends FlatBookLayout { book: BookIndexEntry; x: number }
export interface StackLayout { cellW: number; height: number; align: StackAlign; chaos: number; layers: StackLayoutLayer[] }

/**
 * Pełne ułożenie kupki: sortuje książki **od największej (dół) do najmniejszej
 * (góra)**, wybiera wyrównanie (`stackAlign`) i poziom chaosu (`stackChaos`),
 * i liczy poziomy offset `x` każdej warstwy. Gwarancja: `0 ≤ x ≤ cellW − width`
 * (nic nie wystaje poza komórkę → brak nachodzenia na sąsiednie sloty).
 * `layers[0]` to spód kupki (renderować przez `flex-col-reverse`).
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
  // Wysokość kupki: suma grubości warstw + 1 px marginesu między nimi.
  const height = layers.reduce((s, l) => s + l.thickness, 0) + Math.max(0, layers.length - 1);
  return { cellW, height, align, chaos, layers };
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

/** Znacznik zdobytej NAGRODY (nie nominacji) z color-code do pieczęci na grzbiecie. */
export interface AwardMark { key: "hugo" | "nebula" | "locus"; color: string; label: string }

const AWARD_MARKS: Record<AwardMark["key"], AwardMark> = {
  hugo: { key: "hugo", color: "#fbbf24", label: "Hugo" },      // złoto (rakieta)
  nebula: { key: "nebula", color: "#c084fc", label: "Nebula" }, // fiolet (mgławica)
  locus: { key: "locus", color: "#38bdf8", label: "Locus" },   // błękit
};

/**
 * Zdobyte nagrody książki z color-code. Bierze TYLKO wygrane („Nagroda …" lub
 * „Wszystkie" = Hugo+Nebula+Locus) — **nominacje pomijamy**. Zdeduplikowane,
 * w stałej kolejności Hugo → Nebula → Locus.
 */
export function awardWins(book: BookIndexEntry): AwardMark[] {
  const won = new Set<AwardMark["key"]>();
  for (const a of book.awards) {
    const s = a.toLowerCase().trim();
    if (s === "wszystkie") { won.add("hugo"); won.add("nebula"); won.add("locus"); continue; }
    if (!s.startsWith("nagroda ")) continue;        // pomijamy „Nominacja …" i inne
    if (s.includes("hugo")) won.add("hugo");
    else if (s.includes("nebula")) won.add("nebula");
    else if (s.includes("locus")) won.add("locus");
  }
  return (["hugo", "nebula", "locus"] as const).filter((k) => won.has(k)).map((k) => AWARD_MARKS[k]);
}

/** Czy pozycja ma zdobytą nagrodę (do pieczęci na grzbiecie i półki „Wyróżnione"). */
export function hasAward(book: BookIndexEntry): boolean {
  return awardWins(book).length > 0;
}

/**
 * Rok wydania z pola daty. Pole bywa wielokrotne („1965/1966", „1965, 1966",
 * „1965 (wyd. pol. 1970)") — bierzemy **pierwszy 4-cyfrowy rok z brzegu**, żeby
 * pozycja i tak trafiła do swojej dekady. Brak roku → `null`.
 */
export function parseYear(year: string): number | null {
  const m = String(year ?? "").match(/\d{4}/);
  const y = m ? Number(m[0]) : NaN;
  return Number.isFinite(y) && y > 0 ? y : null;
}

/** Rok wydania jako liczba do sortowania; brak → na koniec. */
function pubYear(b: BookIndexEntry): number {
  return parseYear(b.year) ?? Infinity;
}

/** Porządek wg daty wydania (rosnąco, chronologicznie), remis → tytuł. */
const byYearTitle = (a: BookIndexEntry, b: BookIndexEntry) =>
  pubYear(a) - pubYear(b) || displayTitle(a).localeCompare(displayTitle(b), "pl");

/**
 * Dzieli księgozbiór na dwie półki wg stanu „przeczytane" (z nadpisaniami),
 * każda posortowana wg **daty wydania** (rosnąco), remis → tytuł.
 */
export function splitShelves(books: BookIndexEntry[], overrides: ReadOverrides = {}): Record<ShelfId, BookIndexEntry[]> {
  const read: BookIndexEntry[] = [];
  const toRead: BookIndexEntry[] = [];
  for (const b of books) (isRead(b, overrides) ? read : toRead).push(b);
  read.sort(byYearTitle);
  toRead.sort(byYearTitle);
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
