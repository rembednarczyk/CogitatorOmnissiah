import { describe, it, expect } from "vitest";
import { shortDate, formatDebug, isBookChanged, offerBadges } from "../utils/vintedFormat";
import { VintedResult } from "../hooks/useVintedCheck";

const result = (over: Partial<VintedResult>): VintedResult =>
  ({ id: "1", title: "T", author: "A", vintedItems: [], ...over });

const offer = (over: any = {}) => ({ title: "o", price: "10", priceValue: 10, currency: "zł", url: "u", ...over });

describe("vintedFormat.shortDate", () => {
  it("formats ISO to DD.MM", () => {
    expect(shortDate("2026-03-07T12:00:00.000Z")).toBe("07.03");
  });
  it("returns empty for missing/invalid", () => {
    expect(shortDate(null)).toBe("");
    expect(shortDate("not-a-date")).toBe("");
  });
});

describe("vintedFormat.formatDebug", () => {
  it("renders an error line with status", () => {
    expect(formatDebug({ error: "boom", httpStatus: 403 })).toBe("⚠ boom (403)");
  });
  it("summarizes a grid parse with links/parsed and a delta", () => {
    const s = formatDebug({ chars: 7000, hasFeedGrid: true, itemLinks: 5, parsed: 3, changes: { added: 2, priceDropped: 1 } as any });
    expect(s).toContain("7k");
    expect(s).toContain("grid");
    expect(s).toContain("links:5");
    expect(s).toContain("parsed:3");
    expect(s).toContain("Δ +2 ↓1");
  });
  it("marks block and memory", () => {
    const s = formatDebug({ blockedMarker: true, rssMb: 240 });
    expect(s).toContain("BLOCK");
    expect(s).toContain("mem:240MB");
  });
});

describe("vintedFormat.isBookChanged", () => {
  it("is true only with a baseline changedAt equal to scannedAt", () => {
    expect(isBookChanged(result({ scannedAt: "t1", changedAt: "t1" }))).toBe(true);
    expect(isBookChanged(result({ scannedAt: "t1", changedAt: "t0" }))).toBe(false);
    expect(isBookChanged(result({ scannedAt: "t1" }))).toBe(false); // pierwszy skan
  });
});

describe("vintedFormat.offerBadges", () => {
  it("flags a new offer only when the scan detected a change", () => {
    const r = result({ scannedAt: "t1", changedAt: "t1" });
    expect(offerBadges(offer({ firstSeenAt: "t1" }), r).isNew).toBe(true);
    // pierwszy skan (bez changedAt baseline) → nie „nowa"
    expect(offerBadges(offer({ firstSeenAt: "t1" }), result({ scannedAt: "t1" })).isNew).toBe(false);
    // stara oferta
    expect(offerBadges(offer({ firstSeenAt: "t0" }), r).isNew).toBe(false);
  });
  it("computes a price drop vs the previous scan", () => {
    expect(offerBadges(offer({ prevPrice: 30, priceValue: 22 }), result({})).drop).toBe(8);
    expect(offerBadges(offer({ prevPrice: 20, priceValue: 25 }), result({})).drop).toBeNull();
    expect(offerBadges(offer({ priceValue: 25 }), result({})).drop).toBeNull();
  });
});
