import { MAX_LEAN_DEG } from "./bookshelf";

/**
 * Fizyczne rozłożenie woluminów na półkach regału.
 *
 * Zasady „fizyki":
 * - **Każda półka jest wypełniona bez pustych dziur** — luz rzędu pochłaniają w
 *   pierwszej kolejności pochyłe (oparcie), a resztę wchłania POGRUBIENIE stojących
 *   grzbietów (grubsze książki), bo nikt nie stawia książek z przerwami między
 *   nimi. Dopiero gdyby pogrubienie osiągnęło limity, znikomy resztek luzu idzie
 *   równo w szczeliny.
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
  stretch?: number;    // ile px grzbiet MOŻE zgrubieć, by wypełnić luz (0 = nie pogrubiamy)
}

export interface PlacedItem {
  key: string;
  kind: "spine" | "stack";
  bw: number;
  w: number;           // szerokość do wyrenderowania (≥ bw — po ewentualnym pogrubieniu)
  x: number;           // lewa krawędź, px
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
    return [{ ...strip(row[0]), w: row[0].bw, x: slack / 2, deg: 0 }];
  }

  const gaps = new Array(n - 1).fill(0);
  const extra = new Array(n).fill(0); // pogrubienie każdego grzbietu (px)
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

  // Rozdział luzu.
  let rem = slack;
  const leanCapSum = leanIdx.reduce((s, i) => s + leanAt[i]!.cap, 0);
  if (leanCapSum <= rem) {
    // 1) Pochyłe książki opierają się o sąsiada (szczelina oparcia do limitu).
    for (const i of leanIdx) gaps[i] = leanAt[i]!.cap;
    rem -= leanCapSum;
    // 2) Resztę WCHŁANIA pogrubienie stojących grzbietów — grubsze książki
    //    wypełniają rząd zamiast zostawiać nienaturalne przerwy. Nie pogrubiamy
    //    kupek ani książek, które się pochylają.
    const leaners = new Set(leanIdx.map((i) => leanAt[i]!.leaner));
    const widenable = row
      .map((it, i) => (it.kind === "spine" && !leaners.has(i) ? i : -1))
      .filter((i) => i >= 0 && (row[i].stretch ?? 0) > 0);
    rem = widenEvenly(rem, widenable, (i) => row[i].stretch ?? 0, extra);
    // 3) Znikomy resztek (gdy pogrubienie osiągnęło limity) — równo w szczeliny.
    if (rem > 1e-6) {
      if (freeIdx.length) {
        const per = rem / freeIdx.length;
        for (const i of freeIdx) gaps[i] += per;
      } else {
        const per = rem / (n - 1);
        for (let i = 0; i < n - 1; i++) gaps[i] += per;
      }
    }
  } else {
    // luz mniejszy niż suma limitów oparcia — skalujemy szczeliny proporcjonalnie
    const scale = leanCapSum > 0 ? rem / leanCapSum : 0;
    for (const i of leanIdx) gaps[i] = leanAt[i]!.cap * scale;
  }

  // Pozycje (szerokość = podstawa + pogrubienie).
  const placed: PlacedItem[] = [];
  let x = 0;
  for (let i = 0; i < n; i++) {
    const w = row[i].bw + extra[i];
    placed.push({ ...strip(row[i]), w, x, deg: 0 });
    if (i < n - 1) x += w + gaps[i];
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

function strip(it: PackItem): Omit<PlacedItem, "x" | "deg" | "w"> {
  return { key: it.key, kind: it.kind, bw: it.bw };
}

/**
 * Rozdziela `rem` px na pogrubienie grzbietów `idx`, każdy do limitu `capOf(i)`.
 * Water-filling: równe dokładanie do jeszcze-nienasyconych, aż zabraknie luzu lub
 * miejsca. Zapisuje przyrost do `extra` i zwraca niewykorzystany luz.
 */
function widenEvenly(rem: number, idx: number[], capOf: (i: number) => number, extra: number[]): number {
  let active = idx.filter((i) => capOf(i) - extra[i] > 1e-6);
  let guard = 0;
  while (rem > 1e-6 && active.length && guard++ < 12) {
    const share = rem / active.length;
    const next: number[] = [];
    let progressed = false;
    for (const i of active) {
      const room = capOf(i) - extra[i];
      const add = Math.min(share, room);
      extra[i] += add;
      rem -= add;
      if (add > 1e-9) progressed = true;
      if (capOf(i) - extra[i] > 1e-6) next.push(i);
    }
    active = next;
    if (!progressed) break;
  }
  return rem;
}

/** Pakuje i rozkłada wszystkie woluminy na wypełnione rzędy. */
export function packAndLayout(items: PackItem[], opts: PackOpts): PlacedItem[][] {
  if (opts.rowWidth <= 0) return [];
  const rows = packRows(items, opts.rowWidth, opts.minGap ?? 2);
  return rows.map((r) => layoutRow(r, opts.rowWidth, opts.maxLeanDeg ?? MAX_LEAN_DEG));
}
