import { describe, it, expect } from "vitest";
import { fold, matchBooks, highlight, buildSearchVocab, didYouMean, replaceLastToken } from "../utils/bookSearch";
import { BookIndexEntry } from "../types";

const mk = (over: Partial<BookIndexEntry>): BookIndexEntry => ({
  id: over.plTitle ?? "x", plTitle: "", origTitle: "", author: "", year: "",
  awards: [], zrodlo: [], series: "", partOfCycle: false, ...over,
});

const INDEX: BookIndexEntry[] = [
  mk({ plTitle: "Perelandra", author: "C.S. Lewis" }),
  mk({ plTitle: "Peryferal", author: "William Gibson" }),
  mk({ plTitle: "Hyperion", author: "Dan Simmons" }),
  mk({ plTitle: "Upadek Hyperiona", author: "Dan Simmons" }),
  mk({ plTitle: "Żółw", author: "Autor Testowy" }),
  mk({ plTitle: "Solaris", origTitle: "Solaris", author: "Stanisław Lem" }),
];

describe("matchBooks — ISBN search", () => {
  // „Slan" carries both the modern ISBN-13 and its old ISBN-10 (built by the index).
  const withIsbn = mk({ plTitle: "Slan", author: "Van Vogt", isbns: ["9788370012250"], isbnSearch: "9788370012250 8370012256" });
  const idx = [...INDEX, withIsbn];

  it("finds a book by its full modern ISBN-13", () => {
    expect(matchBooks("9788370012250", idx).map((b) => b.plTitle)).toContain("Slan");
  });

  it("finds a book by its old ISBN-10 (pre-2007)", () => {
    expect(matchBooks("8370012256", idx).map((b) => b.plTitle)).toEqual(["Slan"]);
  });

  it("finds a book by an ISBN PREFIX (how people type them) and tolerates dashes", () => {
    expect(matchBooks("978-83-7001", idx).map((b) => b.plTitle)).toEqual(["Slan"]); // prefix of the ISBN-13
    expect(matchBooks("837001", idx).map((b) => b.plTitle)).toEqual(["Slan"]);       // prefix of the ISBN-10
  });

  it("matches a long (≥8-digit) fragment mid-ISBN, but not a short one", () => {
    expect(matchBooks("83700122", idx).map((b) => b.plTitle)).toEqual(["Slan"]); // 8-digit fragment
    // A short mid-ISBN run (e.g. a year „3700") is NOT a prefix → no noisy match.
    expect(matchBooks("3700", idx).map((b) => b.plTitle)).not.toContain("Slan");
  });

  it("ignores very short numeric fragments (<4 digits) to avoid noise", () => {
    // „83" would otherwise match every Polish ISBN.
    expect(matchBooks("83", idx).map((b) => b.plTitle)).not.toContain("Slan");
  });

  it("does NOT let a common 4-digit number (e.g. a year) match an ISBN that merely contains it", () => {
    // „0012" appears mid-ISBN in Slan's numbers but is not a prefix → no false positive.
    expect(matchBooks("0012", idx).map((b) => b.plTitle)).not.toContain("Slan");
  });

  it("combines an ISBN prefix with a title/author token (AND)", () => {
    expect(matchBooks("slan 837001", idx).map((b) => b.plTitle)).toEqual(["Slan"]);
    expect(matchBooks("hyperion 837001", idx)).toHaveLength(0); // ISBN belongs to another book
  });
});

describe("bookSearch.fold", () => {
  it("folds Polish diacritics per-char (incl. ł which NFD does not decompose)", () => {
    expect(fold("Żółw")).toBe("zolw");
    expect(fold("Miłość")).toBe("milosc");
    expect(fold("PERELANDRA")).toBe("perelandra");
  });
});

describe("bookSearch.matchBooks", () => {
  it("narrows as more characters are typed: 'per' → several, 'pere' → only Perelandra", () => {
    const per = matchBooks("per", INDEX).map((b) => b.plTitle);
    expect(per).toContain("Perelandra");
    expect(per).toContain("Peryferal");
    expect(per.length).toBeGreaterThan(1);

    const pere = matchBooks("pere", INDEX).map((b) => b.plTitle);
    expect(pere).toEqual(["Perelandra"]);
  });

  it("matches diacritics-insensitively ('zolw' → 'Żółw')", () => {
    expect(matchBooks("zolw", INDEX).map((b) => b.plTitle)).toEqual(["Żółw"]);
  });

  it("matches by author across the whole set", () => {
    const simmons = matchBooks("simmons", INDEX).map((b) => b.plTitle);
    expect(simmons).toContain("Hyperion");
    expect(simmons).toContain("Upadek Hyperiona");
    expect(simmons).toHaveLength(2);
  });

  it("AND-combines tokens across fields (author + title)", () => {
    const r = matchBooks("simmons upadek", INDEX).map((b) => b.plTitle);
    expect(r).toEqual(["Upadek Hyperiona"]);
  });

  it("ranks a title-prefix hit above a mid-title hit", () => {
    const r = matchBooks("hyperion", INDEX).map((b) => b.plTitle);
    expect(r[0]).toBe("Hyperion"); // prefix beats "Upadek Hyperiona"
  });

  it("finds and ranks untranslated books by original title when plTitle is empty", () => {
    const idx = [
      mk({ id: "u", plTitle: "", origTitle: "Childe", author: "Gordon Dickson" }),
      mk({ id: "s", plTitle: "Solaris", origTitle: "Solaris", author: "Stanisław Lem" }),
    ];
    const r = matchBooks("childe", idx);
    expect(r.map((b) => b.id)).toEqual(["u"]);
    // a prefix of the effective title (origTitle) ranks like a title prefix
    expect(matchBooks("chi", idx)[0].id).toBe("u");
  });

  it("empty query returns the whole set sorted by title", () => {
    const r = matchBooks("", INDEX).map((b) => b.plTitle);
    expect(r).toHaveLength(INDEX.length);
    expect(r).toEqual([...r].sort((a, b) => a.localeCompare(b, "pl")));
  });
});

describe("bookSearch.didYouMean", () => {
  const vocab = buildSearchVocab(INDEX);

  it("suggests the closest title word for a one-off typo", () => {
    expect(didYouMean("perelanda", vocab)).toContain("Perelandra");
  });

  it("suggests the closest author surname for a typo", () => {
    expect(didYouMean("simnons", vocab)).toContain("Simmons");
  });

  it("uses the last token (typo usually sits in one word)", () => {
    expect(didYouMean("dan simnons", vocab)).toContain("Simmons");
  });

  it("returns nothing when the query is far from everything", () => {
    expect(didYouMean("qwerty", vocab)).toEqual([]);
  });

  it("does not suggest an exact vocabulary hit (distance 0)", () => {
    expect(didYouMean("hyperion", vocab)).not.toContain("Hyperion");
  });

  it("ignores too-short queries", () => {
    expect(didYouMean("pe", vocab)).toEqual([]);
  });
});

describe("bookSearch.replaceLastToken", () => {
  it("replaces only the last token, keeping earlier words", () => {
    expect(replaceLastToken("Greg Vear", "Bear")).toBe("Greg Bear");
    expect(replaceLastToken("dan simnons", "Simmons")).toBe("dan Simmons");
  });

  it("replaces a single token wholesale", () => {
    expect(replaceLastToken("simnons", "Simmons")).toBe("Simmons");
  });

  it("drops trailing whitespace around the last token", () => {
    expect(replaceLastToken("Greg Vear  ", "Bear")).toBe("Greg Bear");
  });

  it("returns the term for an empty / whitespace query", () => {
    expect(replaceLastToken("", "Bear")).toBe("Bear");
    expect(replaceLastToken("   ", "Bear")).toBe("Bear");
  });
});

describe("bookSearch.highlight", () => {
  it("splits into hit/non-hit segments at the matched substring", () => {
    const segs = highlight("Perelandra", "pere");
    expect(segs.filter((s) => s.hit).map((s) => s.text)).toEqual(["Pere"]);
    expect(segs.map((s) => s.text).join("")).toBe("Perelandra");
  });

  it("highlights the correct slice despite diacritics (1:1 fold)", () => {
    const segs = highlight("Żółw", "zol");
    expect(segs.map((s) => s.text).join("")).toBe("Żółw"); // original preserved
    expect(segs.find((s) => s.hit)?.text).toBe("Żół");
  });

  it("returns a single non-hit segment when nothing matches", () => {
    const segs = highlight("Solaris", "xyz");
    expect(segs).toEqual([{ text: "Solaris", hit: false }]);
  });
});
