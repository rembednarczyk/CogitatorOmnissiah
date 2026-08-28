import { describe, it, expect } from "vitest";
import { BoundedCache } from "../boundedCache";

describe("BoundedCache", () => {
  it("stores and reads back like a Map", () => {
    const c = new BoundedCache<number>(10);
    c.set("a", 1);
    expect(c.has("a")).toBe(true);
    expect(c.get("a")).toBe(1);
    expect(c.size).toBe(1);
  });

  it("treats null as a real cached VALUE, not a miss", () => {
    // Both call sites cache „looked it up, there is nothing" as null, so presence must
    // be tested with has() rather than truthiness — otherwise every negative lookup
    // would re-hit the upstream API.
    const c = new BoundedCache<number | null>(10);
    c.set("nothing", null);
    expect(c.has("nothing")).toBe(true);
    expect(c.get("nothing")).toBeNull();
  });

  it("never grows past the cap, evicting the oldest entry", () => {
    const c = new BoundedCache<number>(3);
    c.set("a", 1); c.set("b", 2); c.set("c", 3);
    expect(c.size).toBe(3);

    c.set("d", 4); // evicts "a"
    expect(c.size).toBe(3);
    expect(c.has("a")).toBe(false);
    expect(c.has("b")).toBe(true);
    expect(c.has("d")).toBe(true);
  });

  it("holds the line under a flood of distinct keys (the abuse case)", () => {
    const c = new BoundedCache<number>(50);
    for (let i = 0; i < 5000; i++) c.set(`key-${i}`, i);
    expect(c.size).toBe(50);
    expect(c.has("key-0")).toBe(false);
    expect(c.has("key-4999")).toBe(true);
  });

  it("re-setting an existing key updates it without counting as growth", () => {
    const c = new BoundedCache<number>(2);
    c.set("a", 1); c.set("b", 2);
    c.set("a", 99);
    expect(c.size).toBe(2);
    expect(c.get("a")).toBe(99);
    expect(c.has("b")).toBe(true); // "b" was not evicted by the overwrite
  });

  it("rejects a nonsensical cap instead of silently misbehaving", () => {
    expect(() => new BoundedCache<number>(0)).toThrow();
  });
});
