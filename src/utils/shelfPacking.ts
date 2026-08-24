import { MAX_LEAN_DEG } from "./bookshelf";

/**
 * Fizyczne rozłożenie woluminów na półkach regału.
 *
 * Zasady „fizyki":
 * - **Każda półka jest wypełniona** — wolny luz w rzędzie jest rozdzielany na
 *   szczeliny, tak że pierwszy wolumin zaczyna się na lewej krawędzi, a ostatni
 *   kończy na prawej (bez dziury na końcu).
 * - **Książka pochyla się tylko wtedy, gdy ma się o co oprzeć.** Kąt wynika z
 *   geometrii: `θ = atan(szczelina / wysokość_podpory)`, więc wierzch dokładnie
 *   dosięga górnej krawędzi sąsiada/kupki (opiera się o niego), a nie wisi
 *   bezwładnie pod kątem. Brak szczeliny → książka stoi prosto. Kąt ≤ MAX_LEAN.
 */

export interface PackItem {
  key: string;
  kind: "spine" | "stack";
  bw: number;          // szerokość podstawy (footprint na półce), px
  h: number;           // wysokość widoczna (jako podpora dla sąsiada), px
  leanDir: -1 | 0 | 1; // zamierzony kierunek pochylenia (−1 w lewo, +1 w prawo, 0 brak)
}

export interface PlacedItem {
  key: string;
  kind: "spine" | "stack";
  bw: number;
  x: number;           // lewa krawędź podstawy, px
  deg: number;         // rzeczywisty kąt pochylenia (0 = prosto)
}

export interface PackOpts {
  rowWidth: number;
  minGap?: number;     // minimalny odstęp rezerwowany przy pakowaniu
  maxLeanDeg?: number;
}

const DEG = Math.PI / 180;

/** Zachłanne pakowanie woluminów w rzędy o zadanej szerokości. */
export function packRows(items: PackItem[], rowWidth: number, minGap = 2): PackItem[][] {
  const rows: PackItem[][] = [];
  let row: PackItem[] = [];
  let used = 0;
  for (const it of items) {
    const add = it.bw + (row.length ? minGap : 0);
    if (row.length && used + add > rowWidth) {
      rows.push(row);
      row = [];
      used = 0;
    }
    row.push(it);
    used += row.length === 1 ? it.bw : add;
  }
  if (row.length) rows.push(row);
  return rows;
}

/**
 * Rozkłada jeden rząd na całą szerokość i liczy kąty pochylenia „z podparciem".
 * Zwraca pozycje `x` (lewa krawędź) i kąt `deg` każdego woluminu.
 */
export function layoutRow(row: PackItem[], rowWidth: number, maxLeanDeg = MAX_LEAN_DEG): PlacedItem[] {
  const n = row.length;
  const base = row.reduce((s, it) => s + it.bw, 0);
  const slack = Math.max(0, rowWidth - base);

  if (n === 1) {
    return [{ ...strip(row[0]), x: slack / 2, deg: 0 }];
  }

  const gaps = new Array(n - 1).fill(0);
  const tanMax = Math.tan(maxLeanDeg * DEG);

  // Która szczelina jest „szczeliną oparcia" (książka pochyla się w nią na sąsiada).
  type Lean = { leaner: number; support: number; cap: number };
  const leanAt: (Lean | undefined)[] = new Array(n - 1).fill(undefined);
  for (let i = 0; i < n; i++) {
    const it = row[i];
    if (it.leanDir === 1 && i < n - 1 && !leanAt[i]) {
      leanAt[i] = { leaner: i, support: i + 1, cap: row[i + 1].h * tanMax };
    } else if (it.leanDir === -1 && i > 0 && !leanAt[i - 1]) {
      leanAt[i - 1] = { leaner: i, support: i - 1, cap: row[i - 1].h * tanMax };
    }
  }
  const leanIdx = leanAt.map((l, i) => (l ? i : -1)).filter((i) => i >= 0);
  const freeIdx = gaps.map((_, i) => i).filter((i) => !leanAt[i]);

  // Rozdział luzu: najpierw szczeliny oparcia do swojego limitu (książka opiera
  // się o sąsiada pod kątem ≤ MAX_LEAN), reszta luzu równo w wolne szczeliny.
  let rem = slack;
  const leanCapSum = leanIdx.reduce((s, i) => s + leanAt[i]!.cap, 0);
  if (leanCapSum <= rem) {
    for (const i of leanIdx) gaps[i] = leanAt[i]!.cap;
    rem -= leanCapSum;
    if (freeIdx.length) {
      // Nadmiar luzu (po tym, jak pochyłe już oparły się ile mogły) rozkładamy
      // RÓWNO na wszystkie szczeliny między stojącymi grzbietami. To minimalizuje
      // największą szczelinę — brak pojedynczych pustych „dziur", wszystkie
      // książki są równo koło siebie (a na pełnym rzędzie odstęp jest znikomy).
      const per = rem / freeIdx.length;
      for (const i of freeIdx) gaps[i] = per;
    } else {
      // brak wolnych szczelin — resztę rozkładamy równo na wszystkie
      const per = rem / (n - 1);
      for (let i = 0; i < n - 1; i++) gaps[i] += per;
    }
  } else {
    // luz mniejszy niż suma limitów — skalujemy szczeliny oparcia proporcjonalnie
    const scale = leanCapSum > 0 ? rem / leanCapSum : 0;
    for (const i of leanIdx) gaps[i] = leanAt[i]!.cap * scale;
  }

  // Pozycje.
  const placed: PlacedItem[] = [];
  let x = 0;
  for (let i = 0; i < n; i++) {
    placed.push({ ...strip(row[i]), x, deg: 0 });
    if (i < n - 1) x += row[i].bw + gaps[i];
  }

  // Kąty oparcia: θ = atan(szczelina / wysokość_podpory), znak wg strony podpory.
  for (const i of leanIdx) {
    const { leaner, support } = leanAt[i]!;
    const gap = gaps[i];
    const hs = row[support].h || 1;
    let deg = Math.atan(gap / hs) / DEG;
    deg = Math.min(deg, maxLeanDeg);
    placed[leaner].deg = leaner < support ? deg : -deg;
  }
  return placed;
}

function strip(it: PackItem): Omit<PlacedItem, "x" | "deg"> {
  return { key: it.key, kind: it.kind, bw: it.bw };
}

/** Pakuje i rozkłada wszystkie woluminy na wypełnione rzędy. */
export function packAndLayout(items: PackItem[], opts: PackOpts): PlacedItem[][] {
  if (opts.rowWidth <= 0) return [];
  const rows = packRows(items, opts.rowWidth, opts.minGap ?? 3);
  return rows.map((r) => layoutRow(r, opts.rowWidth, opts.maxLeanDeg ?? MAX_LEAN_DEG));
}
