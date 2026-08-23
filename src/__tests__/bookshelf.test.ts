import { describe, it, expect } from "vitest";
import { BookIndexEntry } from "../types";
import { isRead, spineStyle, spinePose, splitShelves, featuredReads, CLOTH_PALETTE, READ_TAG, shelfPlankBackground, SHELF_ROW_H, SHELF_PLANK_H, SHELF_ROW_GAP } from "../utils/bookshelf";

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

describe("bookshelf.spinePose", () => {
  it("is deterministic for the same title", () => {
    const a = spinePose(mk({ plTitle: "Diuna" }));
    const b = spinePose(mk({ plTitle: "Diuna", id: "other" }));
    expect(a).toEqual(b);
  });
  it("produces only valid poses within bounds", () => {
    for (let i = 0; i < 400; i++) {
      const p = spinePose(mk({ plTitle: `Tytuł ${i}` }));
      if (p.kind === "lean") {
        expect(Math.abs(p.deg)).toBeGreaterThanOrEqual(4);
        expect(Math.abs(p.deg)).toBeLessThanOrEqual(11);
      } else if (p.kind === "flat") {
        expect(p.w).toBeGreaterThanOrEqual(74);
        expect(p.w).toBeLessThanOrEqual(119);
        expect(p.layers).toBeGreaterThanOrEqual(1);
        expect(p.layers).toBeLessThanOrEqual(3);
      } else {
        expect(p.kind).toBe("straight");
      }
    }
  });
  it("keeps most books upright, with a minority leaning/flat", () => {
    const counts = { straight: 0, lean: 0, flat: 0 } as Record<string, number>;
    for (let i = 0; i < 600; i++) counts[spinePose(mk({ plTitle: `Vol ${i}` })).kind]++;
    expect(counts.straight).toBeGreaterThan(counts.lean + counts.flat); // większość stoi prosto
    expect(counts.lean).toBeGreaterThan(0);
    expect(counts.flat).toBeGreaterThan(0);
  });
});

describe("bookshelf.shelfPlankBackground", () => {
  it("draws a plank starting at the row baseline and repeats per row advance", () => {
    const { backgroundImage } = shelfPlankBackground();
    expect(backgroundImage.startsWith("repeating-linear-gradient(180deg,")).toBe(true);
    // Deska zaczyna się dokładnie pod spodem rzędu (SHELF_ROW_H) …
    expect(backgroundImage).toContain(`${SHELF_ROW_H}px`);
    // … kończy po SHELF_PLANK_H …
    expect(backgroundImage).toContain(`${SHELF_ROW_H + SHELF_PLANK_H}px`);
    // … a okres powtórzenia = skok jednego rzędu (ROW_H + GAP).
    expect(backgroundImage).toContain(`${SHELF_ROW_H + SHELF_ROW_GAP}px`);
  });

  it("keeps the plank thinner than the row gap (mieści się w prześwicie)", () => {
    expect(SHELF_PLANK_H).toBeLessThan(SHELF_ROW_GAP);
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
