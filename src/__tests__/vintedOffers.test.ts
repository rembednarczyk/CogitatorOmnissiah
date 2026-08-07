import { describe, it, expect } from "vitest";
import { sortOffersByPrice, offersPriceSummary, formatVintedPrice } from "../utils/vintedOffers";

describe("sortOffersByPrice", () => {
  it("sorts ascending and pushes price-less offers to the end", () => {
    const offers = [
      { priceValue: 18, id: "a" },
      { priceValue: null, id: "b" },
      { priceValue: 5, id: "c" },
      { priceValue: 12, id: "d" },
    ];
    expect(sortOffersByPrice(offers).map((o) => o.id)).toEqual(["c", "d", "a", "b"]);
  });

  it("does not mutate the input array", () => {
    const offers = [{ priceValue: 3 }, { priceValue: 1 }];
    const copy = [...offers];
    sortOffersByPrice(offers);
    expect(offers).toEqual(copy);
  });
});

describe("offersPriceSummary", () => {
  it("returns the minimum known price and the total count", () => {
    expect(offersPriceSummary([{ priceValue: 18 }, { priceValue: 5 }, { priceValue: null }]))
      .toEqual({ min: 5, count: 3 });
  });

  it("returns min=null when no offer has a price", () => {
    expect(offersPriceSummary([{ priceValue: null }, {}])).toEqual({ min: null, count: 2 });
  });
});

describe("formatVintedPrice", () => {
  it("formats a known price in the Polish style", () => {
    expect(formatVintedPrice(12.5, "PLN")).toBe("12,50 zł");
    expect(formatVintedPrice(30, "zł")).toBe("30,00 zł");
  });

  it("falls back to a label when the price is unknown", () => {
    expect(formatVintedPrice(null)).toBe("cena w ofercie");
    expect(formatVintedPrice(undefined)).toBe("cena w ofercie");
  });
});
