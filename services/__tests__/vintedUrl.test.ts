import { describe, it, expect } from "vitest";
import { isVintedUrl, isVintedPhotoUrl } from "../vintedUrl";
import { parseVintedData, offerFromItem, sanitizeStoredOffer } from "../vintedStore";
import { VintedItem } from "../vintedParser";

describe("isVintedUrl", () => {
  it("accepts the URL shapes the parser actually produces", () => {
    expect(isVintedUrl("https://www.vinted.pl/items/123-tytul")).toBe(true);
    expect(isVintedUrl("https://vinted.pl/items/123")).toBe(true);
    expect(isVintedUrl("https://www.vinted.pl/member/456")).toBe(true); // seller profile
  });

  it("rejects the SSRF targets that the old substring filter let through", () => {
    // These all contain „/items/" and so passed `/\/items\//.test(url)`.
    expect(isVintedUrl("http://169.254.169.254/items/")).toBe(false); // cloud metadata
    expect(isVintedUrl("http://localhost:10000/items/")).toBe(false);
    expect(isVintedUrl("http://127.0.0.1/items/admin")).toBe(false);
  });

  it("rejects look-alike hosts (suffix confusion)", () => {
    expect(isVintedUrl("https://evilvinted.pl/items/1")).toBe(false);
    expect(isVintedUrl("https://vinted.pl.attacker.com/items/1")).toBe(false);
    expect(isVintedUrl("https://notvinted.pl/items/1")).toBe(false);
  });

  it("rejects non-web schemes", () => {
    expect(isVintedUrl("javascript:alert(document.domain)")).toBe(false);
    expect(isVintedUrl("data:text/html,<script>alert(1)</script>")).toBe(false);
    expect(isVintedUrl("file:///etc/passwd")).toBe(false);
  });

  it("rejects junk and non-strings", () => {
    expect(isVintedUrl("")).toBe(false);
    expect(isVintedUrl("/items/123")).toBe(false); // relative — not resolvable to a host
    expect(isVintedUrl(null)).toBe(false);
    expect(isVintedUrl(undefined)).toBe(false);
    expect(isVintedUrl(42)).toBe(false);
    expect(isVintedUrl({ toString: () => "https://www.vinted.pl/items/1" })).toBe(false);
  });

  it("allows the image CDN only for photos", () => {
    expect(isVintedPhotoUrl("https://images1.vinted.net/t/abc/photo.jpeg")).toBe(true);
    expect(isVintedUrl("https://images1.vinted.net/t/abc/photo.jpeg")).toBe(false); // not an offer host
    expect(isVintedPhotoUrl("https://evil.example/tracker.gif")).toBe(false);
  });
});

const offer = (over: Record<string, unknown> = {}) => ({
  url: "https://www.vinted.pl/items/1",
  title: "Solaris",
  price: 20,
  currency: "PLN",
  ...over,
});

describe("parseVintedData — re-validates the blob on the way OUT of Notion", () => {
  it("drops an offer whose URL points off-site (the SSRF vector)", () => {
    const raw = JSON.stringify({
      scannedAt: "2026-01-01T00:00:00Z",
      offers: [offer(), offer({ url: "http://169.254.169.254/items/" })],
    });
    const parsed = parseVintedData(raw);
    expect(parsed!.offers).toHaveLength(1);
    expect(parsed!.offers[0].url).toBe("https://www.vinted.pl/items/1");
  });

  it("drops a javascript: URL that would otherwise become an href", () => {
    const raw = JSON.stringify({ scannedAt: "", offers: [offer({ url: "javascript:alert(1)" })] });
    expect(parseVintedData(raw)!.offers).toEqual([]);
  });

  it("keeps the offer but strips a hostile photo", () => {
    const raw = JSON.stringify({ scannedAt: "", offers: [offer({ photo: "https://evil.example/track.gif" })] });
    const parsed = parseVintedData(raw);
    expect(parsed!.offers).toHaveLength(1);
    expect(parsed!.offers[0].photo).toBeNull();
  });

  it("drops a seller whose profile link is off-site, keeping the offer", () => {
    const raw = JSON.stringify({
      scannedAt: "",
      offers: [offer({ seller: { id: "7", login: "x", url: "https://evil.example/member/7" } })],
    });
    const parsed = parseVintedData(raw);
    expect(parsed!.offers).toHaveLength(1);
    expect(parsed!.offers[0].seller).toBeNull();
  });

  it("preserves a legitimate blob unchanged in substance", () => {
    const good = {
      scannedAt: "2026-01-01T00:00:00Z",
      changedAt: "2026-01-02T00:00:00Z",
      offers: [offer({
        photo: "https://images1.vinted.net/t/a/p.jpeg",
        seller: { id: "7", login: "kolekcjoner", url: "https://www.vinted.pl/member/7" },
        prevPrice: 25,
        firstSeenAt: "2025-12-01T00:00:00Z",
      })],
    };
    const parsed = parseVintedData(JSON.stringify(good));
    expect(parsed!.scannedAt).toBe(good.scannedAt);
    expect(parsed!.changedAt).toBe(good.changedAt);
    expect(parsed!.offers).toHaveLength(1);
    expect(parsed!.offers[0]).toMatchObject({
      url: "https://www.vinted.pl/items/1",
      title: "Solaris",
      price: 20,
      currency: "PLN",
      photo: "https://images1.vinted.net/t/a/p.jpeg",
      seller: { id: "7", login: "kolekcjoner", url: "https://www.vinted.pl/member/7" },
      prevPrice: 25,
      firstSeenAt: "2025-12-01T00:00:00Z",
    });
  });

  it("still tolerates a corrupt blob without throwing", () => {
    expect(parseVintedData("{not json")).toBeNull();
    expect(parseVintedData(JSON.stringify({ offers: "nope" }))).toBeNull();
    expect(parseVintedData(JSON.stringify({ offers: [null, 42, "x"] }))!.offers).toEqual([]);
  });
});

describe("offerFromItem — defence in depth on the way IN", () => {
  const item = (over: Partial<VintedItem> = {}): VintedItem => ({
    id: "1", title: "Solaris", url: "https://www.vinted.pl/items/1",
    price: "20", priceValue: 20, currency: "PLN", ...over,
  } as VintedItem);

  it("stores a normal scraped offer", () => {
    expect(offerFromItem(item())).toMatchObject({ url: "https://www.vinted.pl/items/1", price: 20 });
  });

  it("refuses to store an off-site URL scraped from a hostile page", () => {
    expect(offerFromItem(item({ url: "http://169.254.169.254/items/" }))).toBeNull();
  });
});

describe("sanitizeStoredOffer", () => {
  it("normalizes missing/!finite numbers rather than passing them through", () => {
    const o = sanitizeStoredOffer({ url: "https://vinted.pl/items/9", price: "tanio", currency: 7 });
    expect(o).toMatchObject({ price: null, currency: "PLN" });
  });
});
