import { describe, it, expect } from "vitest";
import { mapPageToBook } from "../notionMapper";
import { NotionPage } from "../src/types";

const rt = (s: string) => [{ plain_text: s } as any];

describe("mapPageToBook", () => {
  it("maps a full page into a NotionBook", () => {
    const page: NotionPage = {
      id: "page-1",
      properties: {
        "Tytuł polski": { type: "title", title: rt("Solaris") },
        "Tytuł oryginalny": { type: "rich_text", rich_text: rt("Solaris") },
        "Autor": { type: "multi_select", multi_select: [{ name: "Stanisław Lem" }] },
        "Rok": { type: "multi_select", multi_select: [{ name: "1961" }] },
        "Wydawnictwo": { type: "select", select: { name: "Wydawnictwo Literackie" } },
        "Seria": { type: "rich_text", rich_text: rt("Dzieła") },
        "Część cyklu": { type: "checkbox", checkbox: true },
        "Lp": { type: "title", title: rt("1") },
        "Nagroda": { type: "multi_select", multi_select: [{ name: "Nagroda Hugo" }, { name: "Nagroda Locus" }] },
        "Źródło": { type: "multi_select", multi_select: [{ name: "Przeczytane" }] },
      },
    };

    const book = mapPageToBook(page);
    expect(book).toMatchObject({
      id: "page-1",
      plTitle: "Solaris",
      origTitle: "Solaris",
      author: "Stanisław Lem",
      year: "1961",
      currentWydawnictwo: "Wydawnictwo Literackie",
      currentSeria: "Dzieła",
      currentCzesccyklu: true,
      lp: "1",
      awards: ["Nagroda Hugo", "Nagroda Locus"],
      zrodlo: ["Przeczytane"],
    });
  });

  it("resolves properties case-insensitively and tolerates missing ones", () => {
    const page: NotionPage = {
      id: "page-2",
      properties: {
        "tytuł polski": { type: "title", title: rt("Diuna") }, // lowercase key
      },
    };
    const book = mapPageToBook(page);
    expect(book.plTitle).toBe("Diuna");
    expect(book.author).toBe("");
    expect(book.awards).toEqual([]);
    expect(book.currentCzesccyklu).toBe(false);
    expect(book.year).toBeUndefined();
  });

  it("reads a single select award as a one-element list", () => {
    const page: NotionPage = {
      id: "p", properties: { "Nagroda": { type: "select", select: { name: "Nagroda Nebula" } } },
    };
    expect(mapPageToBook(page).awards).toEqual(["Nagroda Nebula"]);
  });
});
