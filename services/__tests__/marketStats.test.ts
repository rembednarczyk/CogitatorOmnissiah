import { describe, it, expect } from "vitest";
import { computeMarketStats } from "../marketStats";
import { NotionBook } from "../../src/types";

const blob = (offers: any[], extra: any = {}) => JSON.stringify({ scannedAt: "2026-01-01", offers, ...extra });
const mk = (id: string, over: Partial<NotionBook>): NotionBook => ({
  id, plTitle: `T${id}`, origTitle: "", author: "A", year: "1970", zrodlo: [], awards: [],
  currentWydawnictwo: "", currentSeria: "", currentCzesccyklu: false, lp: id,
  plTitleRichText: [], origTitleRichText: [], ...over,
});

describe("marketStats.computeMarketStats", () => {
  it("sums the cheapest wanted-book offers into completion cost", () => {
    const books = [
      mk("1", { vintedData: blob([{ url: "https://www.vinted.pl/items/1", price: 20, currency: "PLN" }, { url: "https://www.vinted.pl/items/2", price: 12, currency: "PLN" }]) }),
      mk("2", { vintedData: blob([{ url: "https://www.vinted.pl/items/3", price: 30, currency: "PLN" }]) }),
    ];
    const m = computeMarketStats(books);
    expect(m.completionCost).toBe(42); // 12 + 30
    expect(m.booksWithOffers).toBe(2);
    expect(m.totalOffers).toBe(3);
    expect(m.currency).toBe("PLN");
    expect(m.cheapest[0]).toMatchObject({ price: 12, bookId: "1" });
  });

  it("excludes owned and read books (already have / don't want)", () => {
    const books = [
      mk("1", { zrodlo: ["Posiadam"], vintedData: blob([{ url: "https://www.vinted.pl/items/1", price: 10, currency: "PLN" }]) }),
      mk("2", { zrodlo: ["Przeczytane"], vintedData: blob([{ url: "https://www.vinted.pl/items/1", price: 10, currency: "PLN" }]) }),
      mk("3", { vintedData: blob([{ url: "https://www.vinted.pl/items/1", price: 15, currency: "PLN" }]) }),
    ];
    const m = computeMarketStats(books);
    expect(m.booksWithOffers).toBe(1);
    expect(m.completionCost).toBe(15);
  });

  it("captures price drops (price < prevPrice), biggest first", () => {
    const books = [
      mk("1", { vintedData: blob([{ url: "https://www.vinted.pl/items/1", price: 18, prevPrice: 25, currency: "PLN" }]) }),
      mk("2", { vintedData: blob([{ url: "https://www.vinted.pl/items/1", price: 40, prevPrice: 100, currency: "PLN" }]) }),
      mk("3", { vintedData: blob([{ url: "https://www.vinted.pl/items/1", price: 10, prevPrice: 8, currency: "PLN" }]) }), // price rise — skipped
    ];
    const m = computeMarketStats(books);
    expect(m.priceDrops.map((d) => d.bookId)).toEqual(["2", "1"]);
    expect(m.priceDrops[0]).toMatchObject({ prevPrice: 100, price: 40 });
  });

  it("ranks sellers by distinct wanted books (>=2), summing per-book minimums", () => {
    const seller = (id: string, login: string) => ({ id, login, url: `https://vinted.pl/member/${id}` });
    const books = [
      mk("1", { vintedData: blob([{ url: "https://www.vinted.pl/items/1", price: 20, currency: "PLN", seller: seller("s1", "ala") }]) }),
      mk("2", { vintedData: blob([{ url: "https://www.vinted.pl/items/1", price: 30, currency: "PLN", seller: seller("s1", "ala") }]) }),
      mk("3", { vintedData: blob([{ url: "https://www.vinted.pl/items/1", price: 15, currency: "PLN", seller: seller("s2", "bob") }]) }), // only 1 book
    ];
    const m = computeMarketStats(books);
    expect(m.topSellers).toHaveLength(1);
    expect(m.topSellers[0]).toMatchObject({ id: "s1", login: "ala", books: 2, total: 50 });
  });

  it("ignores books without offers / without prices / without blob", () => {
    const books = [
      mk("1", {}),                                                   // no blob
      mk("2", { vintedData: blob([]) }),                             // empty
      mk("3", { vintedData: blob([{ url: "https://www.vinted.pl/items/1", price: null, currency: "PLN" }]) }), // no price
    ];
    const m = computeMarketStats(books);
    expect(m).toMatchObject({ completionCost: 0, booksWithOffers: 0, totalOffers: 0 });
    expect(m.cheapest).toEqual([]);
  });
});
