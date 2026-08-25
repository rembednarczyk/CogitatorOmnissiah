import { describe, it, expect } from "vitest";
import { BookIndexEntry } from "../types";
import { canInsertAt, planInsertion } from "../utils/shelfInsertion";
import { effShelfKey, byShelfPosition } from "../utils/bookshelf";

const mk = (id: string, year: string, shelfOrder?: number): BookIndexEntry => ({
  id, plTitle: `T-${id}`, origTitle: "", author: "", year,
  awards: [], zrodlo: [], series: "", partOfCycle: false, shelfOrder,
});

describe("bookshelf.effShelfKey / byShelfPosition", () => {
  it("uses shelfOrder within the book's decade, falls back to year otherwise", () => {
    expect(effShelfKey(mk("a", "1954"))).toBe(1954);
    expect(effShelfKey(mk("a", "1954", 1955.5))).toBe(1955.5);
    // Klucz STALE (spoza dekady książki) — ignorowany.
    expect(effShelfKey(mk("a", "1964", 1955.5))).toBe(1964);
  });

  it("sorts by decade, then manual key interleaved with years, then title", () => {
    const a = mk("a", "1954");            // klucz 1954
    const b = mk("b", "1957", 1954.5);    // ręcznie między 1954 a 1955
    const c = mk("c", "1955");
    const d = mk("d", "1949");            // inna dekada — zawsze przed
    const sorted = [a, b, c, d].sort(byShelfPosition).map((x) => x.id);
    expect(sorted).toEqual(["d", "a", "b", "c"]);
  });
});

describe("shelfInsertion.canInsertAt", () => {
  const seq = [mk("a", "1948"), mk("b", "1952"), mk("c", "1955"), mk("d", "1969")];

  it("allows gaps inside and at the edges of the book's decade section", () => {
    const dragged = mk("x", "1953");
    expect(canInsertAt(seq, dragged, "b")).toBe(true);  // przed 1952 (start sekcji 1950s — lewy sąsiad 1948)
    expect(canInsertAt(seq, dragged, "c")).toBe(true);  // między 1952 a 1955
    expect(canInsertAt(seq, dragged, "d")).toBe(true);  // koniec sekcji 1950s (lewy sąsiad 1955)
  });

  it("rejects gaps in a foreign decade and unknown targets", () => {
    const dragged = mk("x", "1953");
    expect(canInsertAt(seq, dragged, "a")).toBe(false); // przed 1948 — sąsiedzi 1940s/undefined
    expect(canInsertAt(seq, dragged, null)).toBe(false); // koniec półki — lewy sąsiad 1969 (1960s)
    expect(canInsertAt(seq, dragged, "zzz")).toBe(false);
  });

  it("rejects dateless books and accepts drops onto an empty shelf", () => {
    expect(canInsertAt(seq, mk("x", ""), "b")).toBe(false);
    expect(canInsertAt([], mk("x", "1953"), null)).toBe(true);
  });
});

describe("shelfInsertion.planInsertion", () => {
  it("midpoint between distinct keys — a single write", () => {
    const seq = [mk("a", "1952"), mk("b", "1956")];
    const plan = planInsertion(seq, mk("x", "1954"), "b");
    expect(plan?.orders).toEqual([{ pageId: "x", order: 1954 }]);
  });

  it("edge of the decade section: start and end land inside the decade scale", () => {
    const seq = [mk("a", "1948"), mk("b", "1952"), mk("c", "1969")];
    const start = planInsertion(seq, mk("x", "1951"), "b")!.orders[0];
    expect(start.pageId).toBe("x");
    expect(start.order).toBeGreaterThanOrEqual(1950);
    expect(start.order).toBeLessThan(1952);
    const end = planInsertion(seq, mk("y", "1953"), "c")!.orders[0];
    expect(end.order).toBeGreaterThan(1952);
    expect(end.order).toBeLessThan(1960);
  });

  it("tie of same-year keys renumbers only the tied run, preserving final order", () => {
    const seq = [mk("a", "1954"), mk("b", "1954"), mk("c", "1957")];
    const plan = planInsertion(seq, mk("x", "1954"), "b")!;
    // renumeracja: a, x, b (+x) — 3 wpisy; c nietknięte
    expect(plan.orders.map((o) => o.pageId)).toEqual(["a", "x", "b"]);
    const byId = Object.fromEntries(plan.orders.map((o) => [o.pageId, o.order]));
    expect(byId.a).toBeLessThan(byId.x);
    expect(byId.x).toBeLessThan(byId.b);
    expect(byId.b).toBeLessThan(1955); // poniżej następnego rocznika
    for (const o of plan.orders) expect(o.order).toBeGreaterThanOrEqual(1954);
  });

  it("returns null for invalid gaps and empty orders for an empty shelf", () => {
    const seq = [mk("a", "1969")];
    expect(planInsertion(seq, mk("x", "1953"), null)).toBeNull();
    expect(planInsertion([], mk("x", "1953"), null)).toEqual({ orders: [] });
  });

  it("applied plan actually sorts into the intended position", () => {
    const seq = [mk("a", "1954"), mk("b", "1954"), mk("c", "1957")];
    const dragged = mk("x", "1954");
    const plan = planInsertion(seq, dragged, "b")!;
    const byId = Object.fromEntries(plan.orders.map((o) => [o.pageId, o.order]));
    const applied = [...seq, dragged].map((b) => (byId[b.id] !== undefined ? { ...b, shelfOrder: byId[b.id] } : b));
    expect(applied.sort(byShelfPosition).map((b) => b.id)).toEqual(["a", "x", "b", "c"]);
  });
});
