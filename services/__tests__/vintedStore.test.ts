import { describe, it, expect } from "vitest";
import { offerFromItem, serializeVintedData, parseVintedData, mergeOffers, StoredOffer } from "../vintedStore";
import { VintedItem } from "../vintedParser";

describe("vintedStore", () => {
  it("offerFromItem maps VintedItem fields (priceValue → price)", () => {
    const item: VintedItem = {
      title: "T", price: "10", priceValue: 10, currency: "zł", url: "u", photo: "p",
      seller: { id: "1", login: "x", url: "m" },
    };
    expect(offerFromItem(item)).toEqual({
      url: "u", title: "T", price: 10, currency: "zł", photo: "p", seller: { id: "1", login: "x", url: "m" },
    });
  });

  it("serialize + parse round-trips", () => {
    const data = { scannedAt: "2026-01-01T00:00:00.000Z", offers: [{ url: "u", price: 5, currency: "zł" }] };
    expect(parseVintedData(serializeVintedData(data))).toEqual(data);
  });

  it("parseVintedData returns null for empty / corrupt / missing offers array", () => {
    expect(parseVintedData(undefined)).toBeNull();
    expect(parseVintedData("")).toBeNull();
    expect(parseVintedData("{not json")).toBeNull();
    expect(parseVintedData('{"scannedAt":"x"}')).toBeNull();
  });

  it("mergeOffers preserves resolved seller for surviving URLs, drops gone offers, adds new", () => {
    const prev: StoredOffer[] = [
      { url: "a", price: 10, currency: "zł", seller: { id: "1", login: "s1", url: "m1" } },
      { url: "gone", price: 3, currency: "zł", seller: { id: "9", login: "s9", url: "m9" } },
    ];
    const fresh: StoredOffer[] = [
      { url: "a", price: 11, currency: "zł" }, // survived; price changed; no seller in fresh
      { url: "b", price: 7, currency: "zł" },  // new
    ];
    const merged = mergeOffers(fresh, prev);
    expect(merged).toHaveLength(2);
    expect(merged.find(o => o.url === "a")!.seller).toEqual({ id: "1", login: "s1", url: "m1" });
    expect(merged.find(o => o.url === "a")!.price).toBe(11);
    expect(merged.find(o => o.url === "b")!.seller ?? null).toBeNull();
    expect(merged.find(o => o.url === "gone")).toBeUndefined();
  });

  it("mergeOffers keeps the fresh seller when fresh already carries one", () => {
    const merged = mergeOffers(
      [{ url: "a", price: 1, currency: "zł", seller: { id: "new", login: "n", url: "m" } }],
      [{ url: "a", price: 1, currency: "zł", seller: { id: "old", login: "o", url: "m" } }],
    );
    expect(merged[0].seller!.id).toBe("new");
  });
});
