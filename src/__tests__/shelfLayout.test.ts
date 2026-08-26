import { describe, it, expect } from "vitest";
import { chunk, buildShelfItems, decadeOf, decadeLabel, assignDividerPlacement, plateWidth } from "../utils/shelfLayout";
import { PlacedItem } from "../utils/shelfPacking";
import { BookIndexEntry } from "../types";

const mk = (over: Partial<BookIndexEntry>): BookIndexEntry => ({
  id: over.id ?? "x", plTitle: over.plTitle ?? "T", origTitle: "", author: "", year: "",
  awards: [], zrodlo: [], series: "", partOfCycle: false, ...over,
});

describe("shelfLayout.decade", () => {
  it("buckets a year into its decade; blanks → null", () => {
    expect(decadeOf("1954")).toBe(1950);
    expect(decadeOf("1960")).toBe(1960);
    expect(decadeOf("")).toBe(null);
    expect(decadeOf("brak")).toBe(null);
    expect(decadeLabel(1950)).toBe("1950–1959");
    expect(decadeLabel(null)).toBe("bez daty");
  });
  it("takes the FIRST year from multi-date fields (not bez daty)", () => {
    expect(decadeOf("1965/1966")).toBe(1960);
    expect(decadeOf("1965, 1966")).toBe(1960);
    expect(decadeOf("1959 (wyd. pol. 1972)")).toBe(1950);
    expect(decadeOf("wyd. 1948")).toBe(1940);
  });
});

describe("shelfLayout.buildShelfItems (tabliczki dekad)", () => {
  // Sorted by date (as from splitShelves): 1948, 1952, 1955, 1969, none.
  const books = [
    mk({ id: "a", year: "1948" }),
    mk({ id: "b", year: "1952" }),
    mk({ id: "c", year: "1955" }),
    mk({ id: "d", year: "1969" }),
    mk({ id: "e", year: "" }),
  ];

  it("inserts one divider per decade section, before its books", () => {
    const { items, slotByKey } = buildShelfItems(books);
    const dividers = items.filter((it) => it.kind === "divider");
    // decades: 1940, 1950, 1960, no date → 4 plates
    expect(dividers.length).toBe(4);
    const labels = dividers.map((d) => (slotByKey.get(d.key) as { label: string }).label);
    expect(labels).toEqual(["1940–1949", "1950–1959", "1960–1969", "bez daty"]);
  });

  it("keeps every book exactly once and dividers precede their decade", () => {
    const { items } = buildShelfItems(books);
    const seq = items.map((it) => (it.kind === "divider" ? "|" : it.key));
    // the first item is a plate; each book appears once
    expect(seq[0]).toBe("|");
    expect(seq.filter((s) => s !== "|")).toEqual(["a", "b", "c", "d", "e"]);
  });
});

describe("shelfLayout.plateWidth / assignDividerPlacement", () => {
  const div = (key: string, x: number): PlacedItem => ({ key, kind: "divider", bw: 10, w: 10, x, deg: 0 });
  const spine = (key: string, x: number): PlacedItem => ({ key, kind: "spine", bw: 34, w: 34, x, deg: 0 });
  const labels: Record<string, string> = {
    a: "1940–1949", b: "1950–1959", c: "1960–1969", d: "1970–1979",
  };
  const labelOf = (k: string) => labels[k];
  const W = 2000; // wide shelf — no wrapping at the right edge

  it("estimates plate width from label length (mono 11px)", () => {
    expect(plateWidth("1950–1959")).toBe(103); // 37 + 9·7.3
    expect(plateWidth("bez daty")).toBe(96);   // 37 + 8·7.3
    expect(plateWidth("")).toBe(37);
  });

  it("keeps every plate top/right when decades are wide enough", () => {
    const row = [div("a", 0), div("b", 200), div("c", 420)];
    const pl = assignDividerPlacement(row, labelOf, W);
    expect([...pl.values()].every((p) => p.level === "top" && p.dir === "right")).toBe(true);
  });

  it("drops a plate to the bottom when the previous decade is too narrow", () => {
    // b sits only 40px past a → the top plate a (width ~103) collides with b.
    const row = [div("a", 0), div("b", 40), div("c", 420)];
    const pl = assignDividerPlacement(row, labelOf, W);
    expect(pl.get("b")?.level).toBe("bottom");
    expect(pl.get("a")?.level).toBe("top");
    expect(pl.get("c")?.level).toBe("top");
  });

  it("alternates top/bottom greedily and only the middle plate flips in a tight chain", () => {
    // a(0) top; b(40) collides top → bottom; c(80) collides both → top (fallback).
    const row = [div("a", 0), div("b", 40), div("c", 80)];
    const pl = assignDividerPlacement(row, labelOf, W);
    expect(pl.get("a")?.level).toBe("top");
    expect(pl.get("b")?.level).toBe("bottom");
    expect(pl.get("c")?.level).toBe("top"); // fallback = top
  });

  it("extends a plate leftward when it would overflow the right shelf edge", () => {
    // rowWidth 300; b at 240 → 240+103=343 > 300 → extends leftward (no collision with a).
    const row = [div("a", 0), div("b", 240)];
    const pl = assignDividerPlacement(row, labelOf, 300);
    expect(pl.get("a")?.dir).toBe("right");
    expect(pl.get("b")?.dir).toBe("left");
    expect(pl.get("b")?.level).toBe("top");
  });

  it("disables edge detection when rowWidth ≤ 0 (all rightward)", () => {
    const row = [div("a", 0), div("b", 240)];
    const pl = assignDividerPlacement(row, labelOf, 0);
    expect([...pl.values()].every((p) => p.dir === "right")).toBe(true);
  });

  it("sorts by x and ignores non-divider items", () => {
    const row = [spine("s1", 15), div("b", 40), div("a", 0), spine("s2", 200)];
    const pl = assignDividerPlacement(row, labelOf, W);
    expect(pl.get("b")?.level).toBe("bottom");
    expect(pl.has("s1")).toBe(false);
    expect(pl.has("s2")).toBe(false);
  });
});

describe("shelfLayout.chunk", () => {
  it("splits rows into fixed-size segments (regały)", () => {
    expect(chunk([1, 2, 3, 4, 5, 6, 7], 3)).toEqual([[1, 2, 3], [4, 5, 6], [7]]);
  });
  it("returns a single segment for size ≤ 0 or when everything fits", () => {
    expect(chunk([1, 2], 0)).toEqual([[1, 2]]);
    expect(chunk([1, 2], 5)).toEqual([[1, 2]]);
  });
  it("keeps every element exactly once, in order", () => {
    const arr = Array.from({ length: 25 }, (_, i) => i);
    const segs = chunk(arr, 4);
    expect(segs.flat()).toEqual(arr);
    expect(segs.every((s) => s.length <= 4)).toBe(true);
  });
});
