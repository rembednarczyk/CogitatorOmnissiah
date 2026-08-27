import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("playwright-core", () => ({ chromium: { launch: vi.fn() } }));

import { chromium } from "playwright-core";
import { primeWithBrowser } from "../browserPrime";

const launch = chromium.launch as unknown as ReturnType<typeof vi.fn>;

function fakeBrowser(cookies: { name: string; value: string }[], ua: string) {
  const page = {
    goto: vi.fn().mockResolvedValue(undefined),
    waitForTimeout: vi.fn().mockResolvedValue(undefined),
    evaluate: vi.fn().mockResolvedValue(ua),
  };
  const context = {
    newPage: vi.fn().mockResolvedValue(page),
    cookies: vi.fn().mockResolvedValue(cookies),
  };
  return { newContext: vi.fn().mockResolvedValue(context), close: vi.fn().mockResolvedValue(undefined) };
}

describe("primeWithBrowser", () => {
  beforeEach(() => vi.clearAllMocks());

  it("returns a session (UA + cookie header) when the browser yields cf_clearance", async () => {
    launch.mockResolvedValue(fakeBrowser(
      [{ name: "cf_clearance", value: "abc" }, { name: "anon_id", value: "x" }],
      "Mozilla/5.0 (browser)",
    ) as any);
    const s = await primeWithBrowser({ timeoutMs: 1000 });
    expect(s).toEqual({ userAgent: "Mozilla/5.0 (browser)", cookie: "cf_clearance=abc; anon_id=x" });
  });

  it("returns null when no cookies are set within the timeout", async () => {
    launch.mockResolvedValue(fakeBrowser([], "Mozilla/5.0") as any);
    const s = await primeWithBrowser({ timeoutMs: 50 });
    expect(s).toBeNull();
  });

  it("returns null (graceful fallback) when the browser fails to launch", async () => {
    launch.mockRejectedValue(new Error("no chromium binary"));
    const s = await primeWithBrowser({ timeoutMs: 1000 });
    expect(s).toBeNull();
  });
});
