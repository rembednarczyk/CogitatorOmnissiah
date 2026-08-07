import { describe, it, expect } from "vitest";
import { groupBySeller, VintedSeller } from "../utils/vintedSellers";
import { VintedResult } from "../hooks/useVintedCheck";

const seller = (id: string): VintedSeller => ({ id, login: `login-${id}`, url: `https://www.vinted.pl/member/${id}` });
const item = (url: string, priceValue: number) => ({ title: "t", price: String(priceValue), priceValue, currency: "zł", url });
const result = (id: string, title: string, items: ReturnType<typeof item>[]): VintedResult =>
  ({ id, title, author: "Autor", vintedItems: items });

describe("groupBySeller", () => {
  it("bundles a seller who has >=2 different books and sums their prices", () => {
    const results = [
      result("1", "Księga A", [item("https://www.vinted.pl/items/1", 10)]),
      result("2", "Księga B", [item("https://www.vinted.pl/items/2", 20)]),
    ];
    const sellers = {
      "https://www.vinted.pl/items/1": seller("s1"),
      "https://www.vinted.pl/items/2": seller("s1"),
    };
    const bundles = groupBySeller(results, sellers);
    expect(bundles).toHaveLength(1);
    expect(bundles[0].seller.id).toBe("s1");
    expect(bundles[0].entries).toHaveLength(2);
    expect(bundles[0].totalValue).toBe(30);
  });

  it("excludes a seller with only one book", () => {
    const results = [result("1", "Księga A", [item("https://www.vinted.pl/items/1", 10)])];
    const sellers = { "https://www.vinted.pl/items/1": seller("s1") };
    expect(groupBySeller(results, sellers)).toHaveLength(0);
  });

  it("ignores offers whose seller is unresolved (null)", () => {
    const results = [
      result("1", "A", [item("https://www.vinted.pl/items/1", 10)]),
      result("2", "B", [item("https://www.vinted.pl/items/2", 5)]),
    ];
    const sellers = { "https://www.vinted.pl/items/1": null, "https://www.vinted.pl/items/2": seller("s1") };
    expect(groupBySeller(results, sellers)).toHaveLength(0);
  });

  it("does not double-count the same book for one seller and sorts by count", () => {
    const results = [
      result("1", "A", [item("https://www.vinted.pl/items/1", 10), item("https://www.vinted.pl/items/1b", 12)]),
      result("2", "B", [item("https://www.vinted.pl/items/2", 8)]),
      result("3", "C", [item("https://www.vinted.pl/items/3", 8)]),
    ];
    // s1 ma A (dwie oferty tej samej książki) + B; s2 ma tylko C.
    const sellers = {
      "https://www.vinted.pl/items/1": seller("s1"),
      "https://www.vinted.pl/items/1b": seller("s1"),
      "https://www.vinted.pl/items/2": seller("s1"),
      "https://www.vinted.pl/items/3": seller("s2"),
    };
    const bundles = groupBySeller(results, sellers);
    expect(bundles).toHaveLength(1);
    expect(bundles[0].seller.id).toBe("s1");
    expect(bundles[0].entries).toHaveLength(2); // A liczone raz, nie dwa
  });
});
