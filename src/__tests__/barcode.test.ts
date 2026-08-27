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
    mk({ id: "a", plTitle: "Diuna", isbn: "9788375780635" }),
    mk({ id: "b", plTitle: "Bez ISBN" }),
    mk({ id: "c", plTitle: "Inna", isbn: "9780306406157" }),
  ];

  it("finds the entry whose stored ISBN equals the scanned code (digit-only compare)", () => {
    expect(matchIsbnInIndex("978-83-7578-063-5", index)?.id).toBe("a");
  });

  it("returns null when no row carries that ISBN", () => {
    expect(matchIsbnInIndex("9799999999992", index)).toBeNull();
  });

  it("ignores rows without a stored ISBN", () => {
    expect(matchIsbnInIndex("", index)).toBeNull();
  });
});
