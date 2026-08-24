import { describe, it, expect } from "vitest";
import { chunk, buildShelfItems, decadeOf, decadeLabel } from "../utils/shelfLayout";
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
});

describe("shelfLayout.buildShelfItems (tabliczki dekad)", () => {
  // Posortowane po dacie (jak z splitShelves): 1948, 1952, 1955, 1969, brak.
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
    // dekady: 1940, 1950, 1960, bez daty → 4 tabliczki
    expect(dividers.length).toBe(4);
    const labels = dividers.map((d) => (slotByKey.get(d.key) as { label: string }).label);
    expect(labels).toEqual(["1940–1949", "1950–1959", "1960–1969", "bez daty"]);
  });

  it("keeps every book exactly once and dividers precede their decade", () => {
    const { items } = buildShelfItems(books);
    const seq = items.map((it) => (it.kind === "divider" ? "|" : it.key));
    // pierwszy item to tabliczka; każda książka pojawia się raz
    expect(seq[0]).toBe("|");
    expect(seq.filter((s) => s !== "|")).toEqual(["a", "b", "c", "d", "e"]);
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
