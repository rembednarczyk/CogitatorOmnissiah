import { describe, it, expect } from "vitest";
import { robustBookKey, scoreDuplicatePair, isInsertDuplicate } from "../bookMatch";

describe("bookMatch.robustBookKey", () => {
  it("is punctuation/case/whitespace insensitive and sorts multi-authors", () => {
    const a = robustBookKey("Stanisław Lem", "Solaris");
    const b = robustBookKey("stanisław  lem", "  Solaris.  ");
    expect(a).toBe(b);
    expect(a).toBe("solaris|stanisław lem");
    // Multi-author order doesn't matter.
    expect(robustBookKey("A, B", "T")).toBe(robustBookKey("B, A", "T"));
  });

  it("returns empty key for an empty title (so same-author books don't merge)", () => {
    expect(robustBookKey("Author", "")).toBe("");
  });
});

describe("bookMatch.scoreDuplicatePair (7-rule audit)", () => {
  const th = { authorThreshold: 0.85, titleThreshold: 0.85 };

  it("matches identical Polish title", () => {
    expect(scoreDuplicatePair({ plTitle: "Diuna", author: "Herbert" }, { plTitle: "Diuna", author: "Herbert" }, th))
      .toEqual({ reason: "identyczny tytuł PL" });
  });

  it("matches identical original title", () => {
    expect(scoreDuplicatePair({ origTitle: "Dune", author: "Herbert" }, { origTitle: "Dune", author: "Herbert" }, th))
      .toEqual({ reason: "identyczny tytuł oryg." });
  });

  it("matches ≥2 common words with the same author", () => {
    expect(scoreDuplicatePair(
      { origTitle: "The Left Hand of Darkness", author: "Le Guin" },
      { origTitle: "Left Hand Darkness Special", author: "Le Guin" }, th,
    )).toEqual({ reason: "dopasowanie słów + ten sam autor" });
  });

  it("rejects a clearly different author", () => {
    expect(scoreDuplicatePair({ plTitle: "Diuna", author: "Herbert" }, { plTitle: "Diuna", author: "Zajdel" }, th)).toBeNull();
  });

  it("rejects when both records lack any title", () => {
    expect(scoreDuplicatePair({ author: "X" }, { author: "X" }, th)).toBeNull();
  });
});

describe("bookMatch.isInsertDuplicate (insert-guard)", () => {
  it("flags same author + ≥2 common original-title words", () => {
    expect(isInsertDuplicate(
      { author: "Le Guin", originalTitle: "The Left Hand of Darkness" },
      { author: "Le Guin", origTitle: "Left Hand of Darkness" },
    )).toBe(true);
  });

  it("does not flag a different author", () => {
    expect(isInsertDuplicate(
      { author: "Herbert", originalTitle: "Dune Messiah" },
      { author: "Le Guin", origTitle: "Dune Messiah" },
    )).toBe(false);
  });

  it("does not flag a single common word", () => {
    expect(isInsertDuplicate(
      { author: "Lem", originalTitle: "Solaris" },
      { author: "Lem", origTitle: "Fiasko" },
    )).toBe(false);
  });
});
