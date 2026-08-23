import { describe, it, expect } from "vitest";
import { BookIndexEntry } from "../types";
import { isRead, spineStyle, planShelf, leanLayout, MAX_LEAN_DEG, LEAN_TOWARD, spineFontSize, flatBookLayout, FLAT_MAX_W, splitShelves, featuredReads, CLOTH_PALETTE, READ_TAG, shelfPlankBackground, SHELF_ROW_H, SHELF_PLANK_H, SHELF_ROW_GAP } from "../utils/bookshelf";

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

describe("bookshelf.planShelf", () => {
  const shelf = Array.from({ length: 600 }, (_, i) => mk({ id: `b${i}`, plTitle: `Vol ${i}` }));

  it("is deterministic and assigns every book to exactly one slot", () => {
    const a = planShelf(shelf);
    const b = planShelf(shelf);
    expect(a).toEqual(b);
    const ids = a.flatMap((s) => (s.kind === "stack" ? s.books.map((x) => x.id) : [s.book.id]));
    expect(ids).toEqual(shelf.map((x) => x.id));           // każda książka raz, w kolejności
    expect(new Set(ids).size).toBe(shelf.length);          // bez duplikatów
  });

  it("keeps most books upright, with a minority leaning/stacked", () => {
    const slots = planShelf(shelf);
    const straight = slots.filter((s) => s.kind === "spine" && s.lean === 0).length;
    const lean = slots.filter((s) => s.kind === "spine" && s.lean !== 0).length;
    const stacks = slots.filter((s) => s.kind === "stack").length;
    expect(straight).toBeGreaterThan(lean + stacks);        // zdecydowana większość prosto
    expect(lean).toBeGreaterThan(0);
    expect(stacks).toBeGreaterThan(0);
  });

  it("every layer of a stack is a separate real book (4–7, distinct ids)", () => {
    for (const s of planShelf(shelf)) {
      if (s.kind === "stack") {
        expect(s.books.length).toBeGreaterThanOrEqual(4);
        expect(s.books.length).toBeLessThanOrEqual(7);
        expect(new Set(s.books.map((b) => b.id)).size).toBe(s.books.length);
      }
    }
  });

  it("caps lean at MAX_LEAN_DEG and never leans below 3°", () => {
    for (const s of planShelf(shelf)) {
      if (s.kind === "spine" && s.lean !== 0) {
        expect(Math.abs(s.lean)).toBeGreaterThanOrEqual(3);
        expect(Math.abs(s.lean)).toBeLessThanOrEqual(MAX_LEAN_DEG);
      }
    }
  });

  it("never places two stacks next to each other", () => {
    const slots = planShelf(shelf);
    for (let k = 1; k < slots.length; k++) {
      expect(slots[k].kind === "stack" && slots[k - 1].kind === "stack").toBe(false);
    }
    expect(slots.some((s) => s.kind === "stack")).toBe(true); // a jakieś kupki są
  });

  it("leans a stack's neighbours toward the stack (left → +, right → −)", () => {
    const slots = planShelf(shelf);
    let checked = 0;
    for (let k = 0; k < slots.length; k++) {
      if (slots[k].kind !== "stack") continue;
      const left = slots[k - 1], right = slots[k + 1];
      if (left && left.kind === "spine") {
        expect(Math.abs(left.lean)).toBe(LEAN_TOWARD); checked++;
        // kierunek pewny tylko gdy grzbiet nie jest wciśnięty między dwie kupki
        if (slots[k - 2]?.kind !== "stack") expect(left.lean).toBe(LEAN_TOWARD);
      }
      if (right && right.kind === "spine") {
        expect(Math.abs(right.lean)).toBe(LEAN_TOWARD); checked++;
        if (slots[k + 2]?.kind !== "stack") expect(right.lean).toBe(-LEAN_TOWARD);
      }
    }
    expect(checked).toBeGreaterThan(0);
  });
});

describe("bookshelf.leanLayout (reguła: brak nachodzenia)", () => {
  it("straight cell reserves exactly the spine width", () => {
    const style = spineStyle(mk({ plTitle: "Prosto" }));
    expect(leanLayout(style, 0)).toEqual({ cellW: style.width, shiftX: 0 });
  });
  it("reserves the rotated bounding box and centers it (corners within ±cellW/2)", () => {
    for (let i = 0; i < 400; i++) {
      const style = spineStyle(mk({ plTitle: `Tom ${i}` }));
      for (const deg of [-6, -3, 3, 6]) {
        const { cellW, shiftX } = leanLayout(style, deg);
        const a = (deg * Math.PI) / 180;
        const bbox = style.width * Math.abs(Math.cos(a)) + style.height * Math.abs(Math.sin(a));
        expect(cellW).toBeGreaterThanOrEqual(bbox);
        const W = style.width, H = style.height;
        const corners = [[-W / 2, 0], [W / 2, 0], [-W / 2, -H], [W / 2, -H]]
          .map(([x, y]) => x * Math.cos(a) - y * Math.sin(a) + shiftX);
        expect(Math.max(...corners)).toBeLessThanOrEqual(cellW / 2 + 1e-6);
        expect(Math.min(...corners)).toBeGreaterThanOrEqual(-cellW / 2 - 1e-6);
        expect(Math.sign(shiftX)).toBe(-Math.sign(deg));
      }
    }
  });
});

describe("bookshelf.title sizing (pełne nazwy)", () => {
  const style = { color: "#000", width: 20, height: 160 };
  it("spineFontSize shrinks for longer titles, within 6–11 px", () => {
    const short = spineFontSize(style, "Ubik");
    const long = spineFontSize(style, "Opowieści z meekhańskiego pogranicza. Północ-Południe");
    expect(short).toBeGreaterThanOrEqual(long);
    for (const f of [short, long]) {
      expect(f).toBeGreaterThanOrEqual(6);
      expect(f).toBeLessThanOrEqual(11);
    }
  });
  it("flatBookLayout wraps long titles to 2 lines instead of widening past the cap", () => {
    const short = flatBookLayout(mk({ plTitle: "Ubik" }), style);
    expect(short.lines).toBe(1);
    expect(short.width).toBeLessThanOrEqual(FLAT_MAX_W);

    const long = flatBookLayout(mk({ plTitle: "Hyperion i jego długa, rozwlekła kontynuacja opowieści" }), style);
    expect(long.lines).toBe(2);                 // zawija, nie poszerza
    expect(long.width).toBe(FLAT_MAX_W);        // szerokość zaczepiona na limicie
    expect(long.thickness).toBeGreaterThan(short.thickness); // 2 linie → trochę grubsza

    for (const l of [short, long]) {
      expect(l.width).toBeLessThanOrEqual(FLAT_MAX_W);
      expect(l.fontSize).toBeGreaterThanOrEqual(7);
      expect(l.fontSize).toBeLessThanOrEqual(10);
      expect(l.thickness).toBeGreaterThanOrEqual(15);
      expect(l.thickness).toBeLessThanOrEqual(24);
      // 2 linie muszą wystarczyć na pełny tytuł: połowa tekstu mieści się w linii
      const availW = FLAT_MAX_W - 20;
      expect(Math.ceil((l === long ? "Hyperion i jego długa, rozwlekła kontynuacja opowieści".length : 4) * 0.6 * l.fontSize / l.lines)).toBeLessThanOrEqual(availW);
    }
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
