import { describe, it, expect } from "vitest";
import { normalizeIsbn, isValidIsbn13, isValidIsbn10, isbn10to13 } from "../isbn";

describe("isbn helpers", () => {
  it("validates ISBN-13 checksums", () => {
    expect(isValidIsbn13("9788375780635")).toBe(true); // real ISBN-13
    expect(isValidIsbn13("9788375780636")).toBe(false); // bad check digit
    expect(isValidIsbn13("978837578063")).toBe(false);  // 12 digits
  });

  it("validates ISBN-10 checksums (incl. trailing X)", () => {
    expect(isValidIsbn10("0306406152")).toBe(true);
    expect(isValidIsbn10("080442957X")).toBe(true); // X check char
    expect(isValidIsbn10("0306406153")).toBe(false);
  });

  it("converts ISBN-10 to ISBN-13", () => {
    expect(isbn10to13("0306406152")).toBe("9780306406157");
  });

  it("normalizes messy input to a canonical ISBN-13", () => {
    expect(normalizeIsbn("978-83-7578-063-5")).toBe("9788375780635");
    expect(normalizeIsbn(" 0306406152 ")).toBe("9780306406157"); // ISBN-10 → 13
  });

  it("rejects non-book EAN-13 (prefix not 978/979) and bad checksums", () => {
    expect(normalizeIsbn("5901234123457")).toBeNull(); // valid EAN, not a book prefix
    expect(normalizeIsbn("9788375780636")).toBeNull(); // book prefix, bad checksum
    expect(normalizeIsbn("hello")).toBeNull();
    expect(normalizeIsbn("")).toBeNull();
  });
});
