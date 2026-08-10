import { describe, it, expect } from "vitest";
import { fold, matchBooks, highlight } from "../utils/bookSearch";
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
    // prefiks tytułu efektywnego (origTitle) rankuje jak prefiks tytułu
    expect(matchBooks("chi", idx)[0].id).toBe("u");
  });

  it("empty query returns the whole set sorted by title", () => {
    const r = matchBooks("", INDEX).map((b) => b.plTitle);
    expect(r).toHaveLength(INDEX.length);
    expect(r).toEqual([...r].sort((a, b) => a.localeCompare(b, "pl")));
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
