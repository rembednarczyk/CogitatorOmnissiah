import { describe, it, expect } from "vitest";
import { mapPageToBook } from "../../notionMapper";
import { toSearchIndex } from "../bookSearchIndex";
import { matchIsbnInIndex } from "../../src/utils/barcode";

// Reproduce the exact production path for a scanned Polish ISBN.
const page = (isbnValue: string, kategoria?: string) => ({
  id: "p1",
  properties: {
    "Lp": { type: "title", title: [{ plain_text: "12" }] },
    "Tytuł polski": { type: "rich_text", rich_text: [{ plain_text: "Miecz dla Króla" }] },
    "Autor": { type: "multi_select", multi_select: [{ name: "Autor" }] },
    "ISBN": { type: "rich_text", rich_text: [{ plain_text: isbnValue }] },
    ...(kategoria ? { "Kategoria": { type: "select", select: { name: kategoria } } } : {}),
  },
}) as any;

describe("scan flow integration (mapper → search index → match)", () => {
  it("matches a stored single ISBN end-to-end", () => {
    const book = mapPageToBook(page("9788375900019"));
    expect(book.isbns).toEqual(["9788375900019"]);
    const index = toSearchIndex([book]);
    expect(index[0].isbns).toEqual(["9788375900019"]);
    expect(matchIsbnInIndex("9788375900019", index)?.plTitle).toBe("Miecz dla Króla");
  });

  it("matches when the ISBN is one of several stored, comma-joined", () => {
    const book = mapPageToBook(page("9780553801477, 9788375900019"));
    const index = toSearchIndex([book]);
    expect(matchIsbnInIndex("9788375900019", index)?.plTitle).toBe("Miecz dla Króla");
  });

  it("DROPS the book from the index when it is a cycle volume (Tom cyklu)", () => {
    const book = mapPageToBook(page("9788375900019", "Tom cyklu"));
    const index = toSearchIndex([book]);
    expect(index).toHaveLength(0);
    expect(matchIsbnInIndex("9788375900019", index)).toBeNull();
  });
});
