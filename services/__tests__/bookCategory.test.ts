// @vitest-environment node
import { describe, it, expect } from "vitest";
import { isAwardBook, isCycleVolume, CYCLE_VOLUME_CATEGORY } from "../bookCategory";
import { toSearchIndex } from "../bookSearchIndex";
import { NotionBook } from "../../src/types";

describe("bookCategory", () => {
  it("brak kategorii = nagrodowa (zgodność wstecz)", () => {
    expect(isAwardBook({})).toBe(true);
    expect(isCycleVolume({})).toBe(false);
    expect(isAwardBook({ kategoria: "Nagroda" })).toBe(true);
  });

  it("Tom cyklu = nie-nagrodowa", () => {
    expect(isCycleVolume({ kategoria: CYCLE_VOLUME_CATEGORY })).toBe(true);
    expect(isAwardBook({ kategoria: CYCLE_VOLUME_CATEGORY })).toBe(false);
  });
});

describe("toSearchIndex — wyklucza tomy cykli", () => {
  const mk = (id: string, kategoria?: string): NotionBook => ({
    id, plTitle: `Tytuł ${id}`, origTitle: "", awards: [], kategoria,
  } as NotionBook);

  it("indeks (Regał/Skryptorium) pomija Kategoria=Tom cyklu", () => {
    const idx = toSearchIndex([mk("a"), mk("b", CYCLE_VOLUME_CATEGORY), mk("c", "Nagroda")]);
    expect(idx.map((e) => e.id)).toEqual(["a", "c"]);
  });
});
