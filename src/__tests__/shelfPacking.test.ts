import { describe, it, expect } from "vitest";
import { PackItem, packRows, layoutRow, packAndLayout, STRAIGHT_GAP, MAX_BREAK } from "../utils/shelfPacking";
import { MAX_LEAN_DEG } from "../utils/bookshelf";

const spine = (key: string, bw = 20, h = 150, leanDir: -1 | 0 | 1 = 0): PackItem => ({ key, kind: "spine", bw, h, leanDir });

describe("shelfPacking.packRows", () => {
  it("packs items into rows that fit the width", () => {
    const items = Array.from({ length: 30 }, (_, i) => spine(`b${i}`, 20));
    const rows = packRows(items, 200, 3);
    for (const r of rows) {
      const base = r.reduce((s, it) => s + it.bw, 0) + 3 * (r.length - 1);
      expect(base).toBeLessThanOrEqual(200 + 1e-9);
    }
    expect(rows.flat().map((x) => x.key)).toEqual(items.map((x) => x.key)); // nic nie zgubione
  });
  it("always keeps at least one item per row even if too wide", () => {
    const rows = packRows([spine("wide", 400)], 200, 3);
    expect(rows).toEqual([[expect.objectContaining({ key: "wide" })]]);
  });
});

describe("shelfPacking.layoutRow (wypełnienie + fizyka oparcia)", () => {
  it("fills the row edge-to-edge: first at x=0, last ends at rowWidth", () => {
    const row = [spine("a", 20), spine("b", 30), spine("c", 25)];
    const placed = layoutRow(row, 200);
    expect(placed[0].x).toBeCloseTo(0, 6);
    const last = placed[placed.length - 1];
    expect(last.x + last.bw).toBeCloseTo(200, 6);
  });

  it("keeps items in order and non-overlapping at the base", () => {
    const row = [spine("a", 20), spine("b", 30, 150, 1), spine("c", 25)];
    const placed = layoutRow(row, 220);
    for (let i = 1; i < placed.length; i++) {
      expect(placed[i].x).toBeGreaterThanOrEqual(placed[i - 1].x + placed[i - 1].bw - 1e-9);
    }
  });

  it("a leaning book rests at θ = atan(gap / supportHeight), capped at MAX_LEAN", () => {
    // a leans right onto b (support height 100). Duży luz → kąt ograniczony do MAX_LEAN.
    const row = [spine("a", 20, 150, 1), spine("b", 30, 100)];
    const placed = layoutRow(row, 400);
    const leaner = placed[0];
    expect(leaner.deg).toBeGreaterThan(0);              // pochyla się w prawo (w stronę podpory)
    expect(leaner.deg).toBeLessThanOrEqual(MAX_LEAN_DEG + 1e-9);
    // gap między a i b odpowiada kątowi: gap = supportH * tan(deg)
    const gap = placed[1].x - (leaner.x + leaner.bw);
    const expectDeg = Math.min(MAX_LEAN_DEG, Math.atan(gap / 100) * 180 / Math.PI);
    expect(leaner.deg).toBeCloseTo(expectDeg, 4);
  });

  it("keeps upright books touching: most straight gaps ≈ STRAIGHT_GAP, overflow in few capped breaks", () => {
    // 12 stojących grzbietów, spory luz, brak pochyłów → mają stać tuż koło siebie.
    const row = Array.from({ length: 12 }, (_, i) => spine(`s${i}`, 20));
    const placed = layoutRow(row, 340); // base 240, slack 100 (rząd raczej pełny)
    const gaps: number[] = [];
    for (let i = 1; i < placed.length; i++) gaps.push(placed[i].x - (placed[i - 1].x + placed[i - 1].bw));
    const tight = gaps.filter((g) => g <= STRAIGHT_GAP + 1e-6).length;
    const breaks = gaps.filter((g) => g > STRAIGHT_GAP + 1e-6);
    expect(tight).toBeGreaterThan(breaks.length * 2);         // znaczna większość zwarta
    for (const g of breaks) expect(g).toBeLessThanOrEqual(MAX_BREAK + 1e-6); // każda przerwa ograniczona
    const last = placed[placed.length - 1];
    expect(last.x + last.bw).toBeCloseTo(340, 6);             // wypełnione do prawej
  });

  it("stands straight when there is no slack (packed tight → no unsupported lean)", () => {
    const row = [spine("a", 100, 150, 1), spine("b", 100, 150)];
    const placed = layoutRow(row, 200); // base 200 == rowWidth → slack 0
    expect(placed[0].deg).toBe(0);
    expect(placed[1].deg).toBe(0);
  });

  it("never leans an edge book outward (no support beyond the row edge)", () => {
    const row = [spine("a", 20, 150, -1), spine("b", 20, 150), spine("c", 20, 150, 1)];
    const placed = layoutRow(row, 300);
    expect(placed[0].deg).toBe(0);                       // pierwszy nie pochyli się w lewo (brak podpory)
    expect(placed[placed.length - 1].deg).toBe(0);       // ostatni nie pochyli się w prawo
  });
});

describe("shelfPacking.packAndLayout", () => {
  it("returns no rows for non-positive width and fills every row otherwise", () => {
    const items = Array.from({ length: 40 }, (_, i) => spine(`b${i}`, 18 + (i % 5)));
    expect(packAndLayout(items, { rowWidth: 0 })).toEqual([]);
    const rows = packAndLayout(items, { rowWidth: 240 });
    for (const row of rows) {
      if (row.length === 1) continue;                    // pojedyncze centrowane
      const last = row[row.length - 1];
      expect(last.x + last.bw).toBeCloseTo(240, 4);      // każdy rząd wypełniony do prawej
    }
  });
});
