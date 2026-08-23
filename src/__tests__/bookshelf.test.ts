import { describe, it, expect } from "vitest";
import { BookIndexEntry } from "../types";
import { isRead, spineStyle, splitShelves, featuredReads, CLOTH_PALETTE, READ_TAG } from "../utils/bookshelf";

const mk = (over: Partial<BookIndexEntry>): BookIndexEntry => ({
  id: over.id ?? over.plTitle ?? "x", plTitle: "", origTitle: "", author: "", year: "",
  awards: [], zrodlo: [], series: "", partOfCycle: false, ...over,
});

describe("bookshelf.isRead", () => {
  it("reads the Przeczytane tag from zrodlo", () => {
    expect(isRead(mk({ zrodlo: [READ_TAG] }))).toBe(true);
    expect(isRead(mk({ zrodlo: ["Posiadam"] }))).toBe(false);
  });
  it("lets an override win over the base state", () => {
    const b = mk({ id: "b1", zrodlo: ["Posiadam"] });
    expect(isRead(b, { b1: true })).toBe(true);
    const r = mk({ id: "r1", zrodlo: [READ_TAG] });
    expect(isRead(r, { r1: false })).toBe(false);
  });
});

describe("bookshelf.spineStyle", () => {
  it("is deterministic for the same title", () => {
    const a = spineStyle(mk({ plTitle: "Diuna" }));
    const b = spineStyle(mk({ plTitle: "Diuna", id: "other" }));
    expect(a).toEqual(b);
  });
  it("stays within palette and size bounds", () => {
    for (const t of ["Diuna", "Hyperion", "Ubik", "Solaris", "Lód"]) {
      const s = spineStyle(mk({ plTitle: t }));
      expect(CLOTH_PALETTE).toContain(s.color);
      expect(s.width).toBeGreaterThanOrEqual(16);
      expect(s.width).toBeLessThanOrEqual(27);
      expect(s.height).toBeGreaterThanOrEqual(124);
      expect(s.height).toBeLessThanOrEqual(171);
    }
  });
});

describe("bookshelf.splitShelves", () => {
  const books = [
    mk({ id: "1", plTitle: "B", author: "Lem", zrodlo: [READ_TAG] }),
    mk({ id: "2", plTitle: "A", author: "Lem", zrodlo: ["Posiadam"] }),
    mk({ id: "3", plTitle: "C", author: "Dick", zrodlo: [READ_TAG] }),
  ];

  it("partitions by read state", () => {
    const { read, toRead } = splitShelves(books);
    expect(read.map((b) => b.id).sort()).toEqual(["1", "3"]);
    expect(toRead.map((b) => b.id)).toEqual(["2"]);
  });

  it("sorts each shelf by author then title", () => {
    const { read } = splitShelves(books);
    // Dick/C before Lem/B
    expect(read.map((b) => b.id)).toEqual(["3", "1"]);
  });

  it("respects overrides when partitioning (drag&drop move)", () => {
    const { read, toRead } = splitShelves(books, { "1": false });
    expect(read.map((b) => b.id)).toEqual(["3"]);
    expect(toRead.map((b) => b.id).sort()).toEqual(["1", "2"]);
  });
});

describe("bookshelf.featuredReads", () => {
  it("keeps only read + awarded, sorted by year desc, limited", () => {
    const books = [
      mk({ id: "1", plTitle: "Old", zrodlo: [READ_TAG], awards: ["Nagroda Hugo"], year: "1990" }),
      mk({ id: "2", plTitle: "New", zrodlo: [READ_TAG], awards: ["Nagroda Nebula"], year: "2010" }),
      mk({ id: "3", plTitle: "Unread", zrodlo: ["Posiadam"], awards: ["Nagroda Hugo"], year: "2020" }),
      mk({ id: "4", plTitle: "ReadNoAward", zrodlo: [READ_TAG], awards: [], year: "2000" }),
    ];
    const f = featuredReads(books, {}, 12).map((b) => b.id);
    expect(f).toEqual(["2", "1"]); // read+award only, newest first
  });

  it("respects the limit", () => {
    const many = Array.from({ length: 20 }, (_, i) =>
      mk({ id: String(i), plTitle: `T${i}`, zrodlo: [READ_TAG], awards: ["Nagroda X"], year: String(2000 + i) }));
    expect(featuredReads(many, {}, 5)).toHaveLength(5);
  });
});
