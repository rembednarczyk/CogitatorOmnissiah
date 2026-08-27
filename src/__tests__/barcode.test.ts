import { describe, it, expect } from "vitest";
import { cleanScannedCode, looksLikeBookIsbn, matchIsbnInIndex } from "../utils/barcode";
import { BookIndexEntry } from "../types";

const mk = (over: Partial<BookIndexEntry>): BookIndexEntry => ({
  id: over.id ?? over.plTitle ?? "x", plTitle: "", origTitle: "", author: "", year: "",
  awards: [], zrodlo: [], series: "", partOfCycle: false, ...over,
});

describe("barcode.cleanScannedCode", () => {
  it("strips dashes and spaces to bare digits", () => {
    expect(cleanScannedCode("978-83-7578-063-5")).toBe("9788375780635");
    expect(cleanScannedCode("  978 0306406157 ")).toBe("9780306406157");
  });
});

describe("barcode.looksLikeBookIsbn", () => {
  it("accepts a 13-digit Bookland (978/979) code", () => {
    expect(looksLikeBookIsbn("9788375780635")).toBe(true);
    expect(looksLikeBookIsbn("9791234567896")).toBe(true);
  });
  it("rejects non-book EAN and wrong length", () => {
    expect(looksLikeBookIsbn("5901234123457")).toBe(false); // product EAN, not a book
    expect(looksLikeBookIsbn("0306406152")).toBe(false);    // ISBN-10 length
  });
});

describe("barcode.matchIsbnInIndex", () => {
  const index = [
    mk({ id: "a", plTitle: "Diuna", isbns: ["9788375780635", "9788373196919"] }),
    mk({ id: "b", plTitle: "Bez ISBN" }),
    mk({ id: "c", plTitle: "Inna", isbns: ["9780306406157"] }),
  ];

  it("matches on the first stored edition ISBN (digit-only compare)", () => {
    expect(matchIsbnInIndex("978-83-7578-063-5", index)?.id).toBe("a");
  });

  it("matches on any OTHER stored edition ISBN too", () => {
    expect(matchIsbnInIndex("9788373196919", index)?.id).toBe("a");
  });

  it("returns null when no row carries that ISBN", () => {
    expect(matchIsbnInIndex("9799999999992", index)).toBeNull();
  });

  it("ignores rows without stored ISBNs", () => {
    expect(matchIsbnInIndex("", index)).toBeNull();
  });

  it("matches a typed OLD ISBN-10 against the stored ISBN-13 (via isbnSearch)", () => {
    // Slan: stored as ISBN-13, but the antiquarian book prints the pre-2007 ISBN-10.
    const withOld = [mk({ id: "slan", plTitle: "Slan", isbns: ["9788370012250"], isbnSearch: "9788370012250 8370012256" })];
    expect(matchIsbnInIndex("8370012256", withOld)?.id).toBe("slan");        // old ISBN-10 typed
    expect(matchIsbnInIndex("83-7001-225-6", withOld)?.id).toBe("slan");     // with dashes
    expect(matchIsbnInIndex("9788370012250", withOld)?.id).toBe("slan");     // modern ISBN-13
  });
});
