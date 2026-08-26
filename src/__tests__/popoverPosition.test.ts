import { describe, it, expect } from "vitest";
import { computePopoverPosition } from "../utils/popoverPosition";

const vp = { width: 1000, height: 800 };

describe("computePopoverPosition", () => {
  it("places below the anchor when there is more room below", () => {
    const pos = computePopoverPosition({ top: 100, bottom: 120, left: 200, right: 260, width: 60 }, vp);
    expect(pos.placement).toBe("below");
    expect(pos.top).toBe(126); // bottom + gap(6)
    expect(pos.bottom).toBeUndefined();
    expect(pos.maxHeight).toBeGreaterThan(600); // roughly the space below
  });

  it("flips above when the anchor sits low on the screen", () => {
    const pos = computePopoverPosition({ top: 700, bottom: 720, left: 200, right: 260, width: 60 }, vp);
    expect(pos.placement).toBe("above");
    expect(pos.bottom).toBe(vp.height - 700 + 6); // anchored to anchor.top
    expect(pos.top).toBeUndefined();
    expect(pos.maxHeight).toBeGreaterThan(600);
  });

  it("clamps left so a right-edge anchor stays fully on screen", () => {
    const pos = computePopoverPosition({ top: 100, bottom: 120, left: 980, right: 995, width: 15 }, vp);
    expect(pos.left).toBe(vp.width - pos.width - 8); // margin 8
    expect(pos.left).toBeGreaterThanOrEqual(8);
  });

  it("shrinks width to fit a narrow viewport", () => {
    const pos = computePopoverPosition({ top: 10, bottom: 30, left: 5, right: 40, width: 35 }, { width: 320, height: 700 });
    expect(pos.width).toBe(320 - 16); // vp.width - 2*margin
    expect(pos.left).toBe(8);
  });

  it("never returns a maxHeight below the floor even in a tight spot", () => {
    const pos = computePopoverPosition({ top: 395, bottom: 405, left: 100, right: 150, width: 50 }, { width: 1000, height: 410 });
    expect(pos.maxHeight).toBeGreaterThanOrEqual(140);
  });
});
