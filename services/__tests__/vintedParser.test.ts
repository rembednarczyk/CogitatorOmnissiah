import { describe, it, expect } from "vitest";
import { parseVintedItems, parseVintedPrice, extractPriceFromText, vintedDiagnostics } from "../vintedParser";

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

  it("exposes a numeric priceValue and a photo from the catalog JSON", () => {
    const html = catalogHtml({
      items: { list: [{ id: 1, title: "Solaris Lem", price: { amount: "12,50", currency_code: "PLN" }, url: "/items/1", photo: { url: "https://img/1.jpg" } }] },
    });
    const items = parseVintedItems(html, "Solaris", "Lem");
    expect(items[0].priceValue).toBe(12.5);
    expect(items[0].photo).toBe("https://img/1.jpg");
  });

  it("recovers the item price from the offer title attribute when structural price is missing", () => {
    // Realny przypadek: fallback HTML łapie title aukcji z ceną w opisie.
    const html = `<a href="/items/5" title="Pokrzywa i kość, T. Kingfisher, Stan: Bardzo dobry, 12,00 zł, 18,65 zł"></a>`;
    const items = parseVintedItems(html, "Pokrzywa i kość", "Kingfisher");
    expect(items).toHaveLength(1);
    expect(items[0].priceValue).toBe(12); // niższa z pary = cena przedmiotu
    expect(items[0].currency).toBe("zł");
  });

  it("keeps priceValue null when no price is present anywhere", () => {
    const html = `<div class="feed-grid__item"><a href="/items/5" title="Solaris"></a></div>`;
    const items = parseVintedItems(html, "Solaris", "Lem");
    expect(items[0].priceValue).toBeNull();
  });
});

describe("vintedDiagnostics", () => {
  it("flags a likely parser miss: item links present but nothing parsed and no markers", () => {
    const html = `<html><body><a href="/items/1"></a><a href="/items/2"></a></body></html>`;
    const d = vintedDiagnostics(html, 0);
    expect(d.itemLinks).toBe(2);
    expect(d.parsed).toBe(0);
    expect(d.blockedMarker).toBe(false);
    expect(d.noResultsMarker).toBe(false);
  });

  it("detects the catalog JSON path", () => {
    const d = vintedDiagnostics(`<div data-component-name="Catalog"></div>`, 3);
    expect(d.hasCatalogJson).toBe(true);
    expect(d.parsed).toBe(3);
  });

  it("flags a block only for a small challenge page, not a huge normal page", () => {
    // Mała strona challenge → blokada.
    expect(vintedDiagnostics(`<html>Just a moment... checking your browser</html>`, 0).blockedMarker).toBe(true);
    // Wielka normalna strona zawierająca słowo „cloudflare" (analytics) → NIE blokada.
    const huge = `<html>${"x".repeat(200000)} cloudflare robot captcha</html>`;
    expect(vintedDiagnostics(huge, 5).blockedMarker).toBe(false);
  });

  it("detects the no-results marker", () => {
    expect(vintedDiagnostics("Nie znaleźliśmy żadnych przedmiotów", 0).noResultsMarker).toBe(true);
  });
});

describe("extractPriceFromText", () => {
  it("returns the lowest zł/PLN amount found in the text", () => {
    expect(extractPriceFromText("Stan: Bardzo dobry, 15.00 zł, 18.65 zł")).toBe(15);
    expect(extractPriceFromText("cena 9,90 PLN")).toBe(9.9);
  });

  it("returns null when no price token is present", () => {
    expect(extractPriceFromText("Pokrzywa i kość, T. Kingfisher")).toBeNull();
    expect(extractPriceFromText("")).toBeNull();
  });
});

describe("parseVintedPrice", () => {
  it("parses integers, decimals and comma decimals", () => {
    expect(parseVintedPrice("15")).toBe(15);
    expect(parseVintedPrice("12.90")).toBe(12.9);
    expect(parseVintedPrice("25,00")).toBe(25);
    expect(parseVintedPrice("1 200,50")).toBe(1200.5);
    expect(parseVintedPrice(30)).toBe(30);
  });

  it("returns null for placeholders and non-numeric input", () => {
    expect(parseVintedPrice("Sprawdź")).toBeNull();
    expect(parseVintedPrice("??")).toBeNull();
    expect(parseVintedPrice("")).toBeNull();
    expect(parseVintedPrice(null)).toBeNull();
    expect(parseVintedPrice(undefined)).toBeNull();
  });
});
