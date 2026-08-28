// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from "vitest";
import { applyFavicon } from "../favicon";

afterEach(() => {
  delete (window as any).__setFavicon;
});

describe("applyFavicon", () => {
  it("forwards the active theme to the inline-script hook", () => {
    const spy = vi.fn();
    window.__setFavicon = spy;

    applyFavicon("dark");
    applyFavicon("light");

    expect(spy).toHaveBeenNthCalledWith(1, "dark");
    expect(spy).toHaveBeenNthCalledWith(2, "light");
  });

  it("is a no-op when the inline script hasn't registered the hook", () => {
    expect(() => applyFavicon("light")).not.toThrow();
  });
});
