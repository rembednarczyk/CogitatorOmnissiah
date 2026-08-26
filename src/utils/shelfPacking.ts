import { MAX_LEAN_DEG } from "./bookshelf";

/**
 * Physical arrangement of volumes on the Regał shelves.
 *
 * „Physics" rules:
 * - **Every shelf is filled with no empty gaps** — a row's slack is absorbed
 *   first by tilts (leaning), and the rest is absorbed by THICKENING the
 *   standing spines (thicker books), because nobody stands books with gaps
 *   between them. Only if thickening hits its limits does a tiny slack remnant
 *   go evenly into the gaps.
 * - **A book tilts only when it has something to lean on.** The angle follows
 *   from geometry: `θ = atan(gap / support_height)`, so the top exactly
 *   reaches the top edge of the neighbor/pile (leans on it), rather than
 *   hanging limply at an angle. No gap → the book stands upright. Angle ≤ MAX_LEAN.
 */

export interface PackItem {
  key: string;
  kind: "spine" | "stack" | "divider";
  bw: number;          // base width (footprint on the shelf), px
  h: number;           // visible height (as support for a neighbor), px
  leanDir: -1 | 0 | 1; // intended tilt direction (−1 left, +1 right, 0 none)
  stretch?: number;    // how many px the spine MAY thicken to fill slack (0 = don't thicken)
}

export interface PlacedItem {
  key: string;
  kind: "spine" | "stack" | "divider";
  bw: number;
  w: number;           // width to render (≥ bw — after any thickening)
  x: number;           // left edge, px
  deg: number;         // actual tilt angle (0 = upright)
}

export interface PackOpts {
  rowWidth: number;
  minGap?: number;     // minimum spacing reserved during packing
  maxLeanDeg?: number;
}

const DEG = Math.PI / 180;

/** Greedy packing of volumes into rows of the given width. */
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
 * Lays out one row across the full width and computes „supported" tilt angles.
 * Returns each volume's `x` position (left edge) and `deg` angle.
 */
export function layoutRow(row: PackItem[], rowWidth: number, maxLeanDeg = MAX_LEAN_DEG): PlacedItem[] {
  const n = row.length;
  const base = row.reduce((s, it) => s + it.bw, 0);
  const slack = Math.max(0, rowWidth - base);

  if (n === 1) {
    return [{ ...strip(row[0]), w: row[0].bw, x: slack / 2, deg: 0 }];
  }

  const gaps = new Array(n - 1).fill(0);
  const extra = new Array(n).fill(0); // thickening of each spine (px)
  const tanMax = Math.tan(maxLeanDeg * DEG);

  // Which gap is a „lean gap" (a book tilts into it onto a neighbor).
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

  // Slack distribution.
  let rem = slack;
  const leanCapSum = leanIdx.reduce((s, i) => s + leanAt[i]!.cap, 0);
  if (leanCapSum <= rem) {
    // 1) Tilted books lean on a neighbor (lean gap up to the limit).
    for (const i of leanIdx) gaps[i] = leanAt[i]!.cap;
    rem -= leanCapSum;
    // 2) The rest is ABSORBED by thickening the standing spines — thicker books
    //    fill the row instead of leaving unnatural gaps. We don't thicken
    //    piles or books that tilt.
    const leaners = new Set(leanIdx.map((i) => leanAt[i]!.leaner));
    const widenable = row
      .map((it, i) => (it.kind === "spine" && !leaners.has(i) ? i : -1))
      .filter((i) => i >= 0 && (row[i].stretch ?? 0) > 0);
    rem = widenEvenly(rem, widenable, (i) => row[i].stretch ?? 0, extra);
    // 3) A tiny remnant (when thickening hit its limits) — evenly into the gaps.
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
    // slack smaller than the sum of lean limits — scale the gaps proportionally
    const scale = leanCapSum > 0 ? rem / leanCapSum : 0;
    for (const i of leanIdx) gaps[i] = leanAt[i]!.cap * scale;
  }

  // Positions (width = base + thickening).
  const placed: PlacedItem[] = [];
  let x = 0;
  for (let i = 0; i < n; i++) {
    const w = row[i].bw + extra[i];
    placed.push({ ...strip(row[i]), w, x, deg: 0 });
    if (i < n - 1) x += w + gaps[i];
  }

  // Lean angles: θ = atan(gap / support_height), sign per the support's side.
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
 * Distributes `rem` px across thickening of spines `idx`, each up to the `capOf(i)` limit.
 * Water-filling: adding equally to the not-yet-saturated ones until slack or room
 * runs out. Writes the increment into `extra` and returns the unused slack.
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

/** Packs and lays out all volumes into filled rows. */
export function packAndLayout(items: PackItem[], opts: PackOpts): PlacedItem[][] {
  if (opts.rowWidth <= 0) return [];
  const rows = packRows(items, opts.rowWidth, opts.minGap ?? 2);
  return rows.map((r) => layoutRow(r, opts.rowWidth, opts.maxLeanDeg ?? MAX_LEAN_DEG));
}
