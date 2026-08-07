import { describe, it, expect } from "vitest";
import { storedToView, StoredBookPayload } from "../utils/vintedSellers";

describe("storedToView", () => {
  it("maps stored payload → results + sellersByUrl + freshness range", () => {
    const books: StoredBookPayload[] = [
      { id: "1", title: "A", author: "X", scannedAt: "2026-08-05T00:00:00.000Z", offers: [
        { url: "https://www.vinted.pl/items/1", title: "A of", price: 10, currency: "zł", photo: "p", seller: { id: "s1", login: "l1", url: "m1" } },
      ] },
      { id: "2", title: "B", author: "Y", scannedAt: "2026-08-07T00:00:00.000Z", offers: [
        { url: "https://www.vinted.pl/items/2", title: "B of", price: null, currency: "zł", photo: null, seller: null },
      ] },
    ];
    const view = storedToView(books);
    expect(view.results).toHaveLength(2);
    expect(view.results[0]).toMatchObject({ id: "1", title: "A", author: "X", scannedAt: "2026-08-05T00:00:00.000Z" });
    expect(view.results[0].vintedItems[0]).toMatchObject({ url: "https://www.vinted.pl/items/1", priceValue: 10, currency: "zł", photo: "p" });
    // null price → priceValue null (nie „??" jako liczba)
    expect(view.results[1].vintedItems[0].priceValue).toBeNull();
    expect(view.sellersByUrl["https://www.vinted.pl/items/1"]).toEqual({ id: "s1", login: "l1", url: "m1" });
    expect(view.sellersByUrl["https://www.vinted.pl/items/2"]).toBeNull();
    expect(view.oldest).toBe("2026-08-05T00:00:00.000Z");
    expect(view.newest).toBe("2026-08-07T00:00:00.000Z");
  });

  it("handles an empty payload", () => {
    const view = storedToView([]);
    expect(view.results).toEqual([]);
    expect(view.oldest).toBeNull();
    expect(view.newest).toBeNull();
  });
});
