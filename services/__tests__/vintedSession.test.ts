import { describe, it, expect, vi, beforeEach } from "vitest";
import axios from "axios";
import { parseSetCookie, cookieCount, primeVintedSession } from "../vintedSession";

vi.mock("axios");

describe("parseSetCookie", () => {
  it("keeps only name=value pairs, dropping attributes", () => {
    const out = parseSetCookie([
      "cf_clearance=abc123; Path=/; Expires=Wed, 21 Oct 2026 07:28:00 GMT; HttpOnly; Secure",
      "anon_id=xyz; Path=/; SameSite=Lax",
    ]);
    expect(out).toBe("cf_clearance=abc123; anon_id=xyz");
  });

  it("dedupes by cookie name (first wins) and skips malformed entries", () => {
    const out = parseSetCookie(["a=1; Path=/", "a=2; Path=/", "garbage-no-eq", "b=3"]);
    expect(out).toBe("a=1; b=3");
  });

  it("returns empty string for missing / non-array input", () => {
    expect(parseSetCookie(undefined)).toBe("");
    expect(parseSetCookie(null)).toBe("");
    expect(parseSetCookie([])).toBe("");
  });
});

describe("cookieCount", () => {
  it("counts cookies in a Cookie header", () => {
    expect(cookieCount("a=1; b=2; c=3")).toBe(3);
    expect(cookieCount("")).toBe(0);
  });
});

describe("primeVintedSession", () => {
  const agent = {} as any;
  beforeEach(() => vi.clearAllMocks());

  it("returns a pinned UA + cookie when the homepage sets cookies", async () => {
    (axios.get as any).mockResolvedValue({ status: 200, headers: { "set-cookie": ["cf_clearance=abc; Path=/", "anon_id=z; Path=/"] } });
    const s = await primeVintedSession(agent, { timeoutMs: 1000 });
    expect(s.cookie).toBe("cf_clearance=abc; anon_id=z");
    expect(s.userAgent).toMatch(/Mozilla/);
    // Same UA must be used for the priming request itself.
    const call = (axios.get as any).mock.calls[0][1];
    expect(call.headers["User-Agent"]).toBe(s.userAgent);
  });

  it("returns an empty session (UA falls back to per-request rotation) when no cookies are set", async () => {
    (axios.get as any).mockResolvedValue({ status: 200, headers: {} });
    const s = await primeVintedSession(agent, { timeoutMs: 1000 });
    expect(s).toEqual({ userAgent: "", cookie: "" });
  });

  it("swallows network errors and returns an empty session (scan proceeds unprimed)", async () => {
    (axios.get as any).mockRejectedValue(new Error("ECONNRESET"));
    const s = await primeVintedSession(agent, { timeoutMs: 1000 });
    expect(s).toEqual({ userAgent: "", cookie: "" });
  });
});
