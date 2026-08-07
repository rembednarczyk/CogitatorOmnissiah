import { describe, it, expect } from "vitest";
import { parseVintedItems } from "../vintedParser";

// Catalog blob with &quot;-escaped JSON, as in the real page
const catalogHtml = (json: object) =>
  `<html><body><div data-component-name="Catalog" data-props="${JSON.stringify(json)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')}"></div></body></html>`;

describe("parseVintedItems", () => {
  it("parses relevant offers from the catalog JSON blob", () => {
    const html = catalogHtml({
      items: { list: [{ id: 123, title: "Solaris Lem", price: { amount: "15", currency_code: "PLN" }, url: "/items/123" }] },
    });
    const items = parseVintedItems(html, "Solaris", "Lem");
    expect(items).toHaveLength(1);
    expect(items[0]).toMatchObject({ id: 123, price: "15", currency: "PLN", url: "https://www.vinted.pl/items/123" });
  });

  it("filters out irrelevant offers (no title or author overlap)", () => {
    const html = catalogHtml({
      items: { list: [{ id: 9, title: "Zupełnie inna książka", price: { amount: "5" }, url: "/items/9" }] },
    });
    expect(parseVintedItems(html, "Solaris", "Lem")).toHaveLength(0);
  });

  it("caps results at 5", () => {
    const list = Array.from({ length: 8 }, (_, i) => ({ id: i, title: "Solaris", price: { amount: "1" }, url: `/items/${i}` }));
    const items = parseVintedItems(catalogHtml({ items: { list } }), "Solaris", "Lem");
    expect(items).toHaveLength(5);
  });

  it("does not leak the price object when amount is missing", () => {
    const html = catalogHtml({ items: { list: [{ id: 1, title: "Solaris", price: { amount: null, currency_code: "PLN" }, url: "/items/1" }] } });
    const items = parseVintedItems(html, "Solaris", "Lem");
    expect(items[0].price).toBe("??");
    expect(typeof items[0].price).toBe("string");
  });

  it("falls back to feed-grid blocks and reads the amount (not the whole aria-label)", () => {
    const html = `<div class="feed-grid__item">` +
      `<a href="/items/77" title="Solaris Lem"></a>` +
      `<span aria-label="Marka: Książka, cena: 25,00 zł">25,00 zł</span></div>`;
    const items = parseVintedItems(html, "Solaris", "Lem");
    expect(items).toHaveLength(1);
    expect(items[0]).toMatchObject({ title: "Solaris Lem", url: "https://www.vinted.pl/items/77", price: "25,00", currency: "zł" });
  });

  it("returns [] when nothing matches any path", () => {
    expect(parseVintedItems("<html><body>nic</body></html>", "Solaris", "Lem")).toEqual([]);
  });
});
