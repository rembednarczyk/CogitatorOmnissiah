import { describe, it, expect } from "vitest";
import { looksEmpty } from "../vintedParser";
import { computeChangedAt, StoredVintedData, OfferDiff } from "../vintedStore";
import { classifyVintedError } from "../vintedHttp";

describe("vintedParser.looksEmpty", () => {
  it("detects the no-results markers", () => {
    expect(looksEmpty("… Brak wyników …")).toBe(true);
    expect(looksEmpty("Nie znaleźliśmy żadnych przedmiotów")).toBe(true);
  });
  it("is false for a normal page or empty input", () => {
    expect(looksEmpty("<html>oferty</html>")).toBe(false);
    expect(looksEmpty("")).toBe(false);
  });
});

describe("vintedStore.computeChangedAt", () => {
  const prev: StoredVintedData = { scannedAt: "t0", changedAt: "t0", offers: [] };
  const changed: OfferDiff = { added: 1, removed: 0, priceDropped: 0, priceRaised: 0 };
  const same: OfferDiff = { added: 0, removed: 0, priceDropped: 0, priceRaised: 0 };

  it("bumps to scannedAt only with a baseline AND a real change", () => {
    expect(computeChangedAt(prev, changed, "t1")).toBe("t1");
  });
  it("keeps the old changedAt when nothing changed", () => {
    expect(computeChangedAt(prev, same, "t1")).toBe("t0");
  });
  it("is undefined on the first scan (no baseline)", () => {
    expect(computeChangedAt(null, changed, "t1")).toBeUndefined();
  });
});

describe("vintedHttp.classifyVintedError", () => {
  it("waits 5s on 429", () => {
    const r = classifyVintedError({ response: { status: 429 } }, "Diuna");
    expect(r.waitMs).toBe(5000);
    expect(r.message).toContain("429");
  });
  it("does not wait on 403 (Cloudflare)", () => {
    const r = classifyVintedError({ response: { status: 403 } }, "Diuna");
    expect(r.waitMs).toBe(0);
    expect(r.message).toContain("403");
  });
  it("falls back to a generic message with the title", () => {
    const r = classifyVintedError({ message: "socket hang up" }, "Hyperion");
    expect(r.waitMs).toBe(0);
    expect(r.message).toContain("Hyperion");
    expect(r.message).toContain("socket hang up");
  });
});
