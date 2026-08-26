import { describe, it, expect } from "vitest";
import { offerFromItem, serializeVintedData, parseVintedData, mergeAndDiff, hasChanges, toStoredBookView, StoredOffer, StoredVintedData } from "../vintedStore";
import { VintedItem } from "../vintedParser";
import { NotionBook } from "../../src/types";

describe("vintedStore", () => {
  it("toStoredBookView carries cycle metadata (cykl/cyklNr/partOfCycle) from the book", () => {
    const book = {
      id: "b1", plTitle: "Tom II", origTitle: "Vol II", author: "Autor", year: "2000",
      currentCzesccyklu: true, cykl: "Wielka Saga", cyklNr: 2,
      awards: [], zrodlo: [], plTitleRichText: [], origTitleRichText: [],
    } as unknown as NotionBook;
    const data: StoredVintedData = { scannedAt: "2020-01-01T00:00:00Z", offers: [] };

    const view = toStoredBookView(book, data);
    expect(view.partOfCycle).toBe(true);
    expect(view.cykl).toBe("Wielka Saga");
    expect(view.cyklNr).toBe(2);
    expect(view.title).toBe("Tom II");
  });

  it("toStoredBookView leaves cycle fields undefined when the book has none", () => {
    const book = {
      id: "b2", plTitle: "Samotnik", origTitle: "Loner", author: "Autor",
      awards: [], zrodlo: [], plTitleRichText: [], origTitleRichText: [],
    } as unknown as NotionBook;
    const view = toStoredBookView(book, { scannedAt: "2020-01-01T00:00:00Z", offers: [] });
    expect(view.cykl).toBeUndefined();
    expect(view.cyklNr).toBeUndefined();
  });

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

  it("mergeAndDiff preserves seller/firstSeenAt, drops gone, adds new, and records price change", () => {
    const prev: StoredOffer[] = [
      { url: "a", price: 10, currency: "zł", seller: { id: "1", login: "s1", url: "m1" }, firstSeenAt: "2026-01-01T00:00:00.000Z" },
      { url: "gone", price: 3, currency: "zł", seller: { id: "9", login: "s9", url: "m9" } },
    ];
    const fresh: StoredOffer[] = [
      { url: "a", price: 8, currency: "zł" },  // survived; price dropped 10 -> 8; no seller in fresh
      { url: "b", price: 7, currency: "zł" },  // new
    ];
    const { offers, diff } = mergeAndDiff(fresh, prev, "2026-02-01T00:00:00.000Z");
    expect(offers).toHaveLength(2);
    const a = offers.find(o => o.url === "a")!;
    expect(a.seller).toEqual({ id: "1", login: "s1", url: "m1" }); // preserved
    expect(a.price).toBe(8);
    expect(a.prevPrice).toBe(10);                                   // last-scan price recorded
    expect(a.firstSeenAt).toBe("2026-01-01T00:00:00.000Z");         // kept, not restamped
    const b = offers.find(o => o.url === "b")!;
    expect(b.seller ?? null).toBeNull();
    expect(b.firstSeenAt).toBe("2026-02-01T00:00:00.000Z");         // new -> stamped now
    expect(diff).toEqual({ added: 1, removed: 1, priceDropped: 1, priceRaised: 0 });
    expect(hasChanges(diff)).toBe(true);
  });

  it("mergeAndDiff keeps the fresh seller when fresh already carries one, and reports no change", () => {
    const { offers, diff } = mergeAndDiff(
      [{ url: "a", price: 1, currency: "zł", seller: { id: "new", login: "n", url: "m" } }],
      [{ url: "a", price: 1, currency: "zł", seller: { id: "old", login: "o", url: "m" }, firstSeenAt: "2026-01-01T00:00:00.000Z" }],
      "2026-02-01T00:00:00.000Z",
    );
    expect(offers[0].seller!.id).toBe("new");
    expect(hasChanges(diff)).toBe(false); // same url, same price
  });

  it("mergeAndDiff dedupes duplicate URLs in fresh (counts once, stores once)", () => {
    const { offers, diff } = mergeAndDiff(
      [
        { url: "a", price: 5, currency: "zł" },
        { url: "a", price: 5, currency: "zł" }, // duplikat z parsera
        { url: "b", price: 6, currency: "zł" },
      ],
      undefined,
      "2026-02-01T00:00:00.000Z",
    );
    expect(offers).toHaveLength(2);
    expect(offers.map(o => o.url)).toEqual(["a", "b"]);
    expect(diff.added).toBe(2);
  });

  it("mergeAndDiff leaves a legacy survivor (no firstSeenAt) undefined so it isn't marked 'nowa'", () => {
    const { offers } = mergeAndDiff(
      [{ url: "a", price: 10, currency: "zł" }],
      [{ url: "a", price: 10, currency: "zł" }], // stary blob: brak firstSeenAt
      "2026-02-01T00:00:00.000Z",
    );
    expect(offers[0].firstSeenAt).toBeUndefined();
  });

  it("mergeAndDiff counts a price rise separately from a drop", () => {
    const { diff } = mergeAndDiff(
      [{ url: "a", price: 12, currency: "zł" }],
      [{ url: "a", price: 10, currency: "zł" }],
      "2026-02-01T00:00:00.000Z",
    );
    expect(diff).toEqual({ added: 0, removed: 0, priceDropped: 0, priceRaised: 1 });
  });
});
