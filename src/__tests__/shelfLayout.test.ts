import { describe, it, expect } from "vitest";
import { chunk } from "../utils/shelfLayout";

describe("shelfLayout.chunk", () => {
  it("splits rows into fixed-size segments (regały)", () => {
    expect(chunk([1, 2, 3, 4, 5, 6, 7], 3)).toEqual([[1, 2, 3], [4, 5, 6], [7]]);
  });
  it("returns a single segment for size ≤ 0 or when everything fits", () => {
    expect(chunk([1, 2], 0)).toEqual([[1, 2]]);
    expect(chunk([1, 2], 5)).toEqual([[1, 2]]);
  });
  it("keeps every element exactly once, in order", () => {
    const arr = Array.from({ length: 25 }, (_, i) => i);
    const segs = chunk(arr, 4);
    expect(segs.flat()).toEqual(arr);
    expect(segs.every((s) => s.length <= 4)).toBe(true);
  });
});
