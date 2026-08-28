import React from "react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { useHorizontalSwipe } from "../useHorizontalSwipe";

const left = vi.fn();
const right = vi.fn();

const Probe: React.FC<{ enabled?: boolean }> = ({ enabled = true }) => {
  const handlers = useHorizontalSwipe({ onSwipeLeft: left, onSwipeRight: right, enabled });
  return <div data-testid="area" {...handlers} style={{ width: 300, height: 200 }} />;
};

/** One-finger gesture: start at (x0,y0), lift at (x1,y1). */
function swipe(x0: number, y0: number, x1: number, y1: number) {
  const area = screen.getByTestId("area");
  fireEvent.touchStart(area, { touches: [{ clientX: x0, clientY: y0 }] });
  fireEvent.touchMove(area, { touches: [{ clientX: x1, clientY: y1 }] });
  fireEvent.touchEnd(area, { changedTouches: [{ clientX: x1, clientY: y1 }] });
}

beforeEach(() => { left.mockClear(); right.mockClear(); });

describe("useHorizontalSwipe", () => {
  it("fires left on a right-to-left flick", () => {
    render(<Probe />);
    swipe(250, 100, 120, 108);
    expect(left).toHaveBeenCalledOnce();
    expect(right).not.toHaveBeenCalled();
  });

  it("fires right on a left-to-right flick", () => {
    render(<Probe />);
    swipe(80, 100, 220, 95);
    expect(right).toHaveBeenCalledOnce();
    expect(left).not.toHaveBeenCalled();
  });

  it("ignores a vertical scroll — the page keeps its gesture", () => {
    render(<Probe />);
    swipe(150, 40, 165, 260); // big dy, small dx
    expect(left).not.toHaveBeenCalled();
    expect(right).not.toHaveBeenCalled();
  });

  it("ignores a diagonal drag where vertical dominates", () => {
    render(<Probe />);
    swipe(200, 60, 120, 200); // dx -80, dy +140 → vertical wins
    expect(left).not.toHaveBeenCalled();
    expect(right).not.toHaveBeenCalled();
  });

  it("ignores a tap or a nudge below the distance threshold", () => {
    render(<Probe />);
    swipe(150, 100, 150, 100); // tap
    swipe(150, 100, 178, 100); // 28px nudge
    expect(left).not.toHaveBeenCalled();
    expect(right).not.toHaveBeenCalled();
  });

  it("cancels when a second finger joins (pinch-zoom)", () => {
    render(<Probe />);
    const area = screen.getByTestId("area");
    fireEvent.touchStart(area, { touches: [{ clientX: 250, clientY: 100 }] });
    fireEvent.touchMove(area, { touches: [{ clientX: 200, clientY: 100 }, { clientX: 90, clientY: 140 }] });
    fireEvent.touchEnd(area, { changedTouches: [{ clientX: 120, clientY: 100 }] });
    expect(left).not.toHaveBeenCalled();
    expect(right).not.toHaveBeenCalled();
  });

  it("does nothing at all when disabled (single page / drag in progress)", () => {
    render(<Probe enabled={false} />);
    swipe(250, 100, 120, 100);
    expect(left).not.toHaveBeenCalled();
    expect(right).not.toHaveBeenCalled();
  });

  it("ignores a touchend with no preceding touchstart", () => {
    render(<Probe />);
    fireEvent.touchEnd(screen.getByTestId("area"), { changedTouches: [{ clientX: 10, clientY: 100 }] });
    expect(left).not.toHaveBeenCalled();
    expect(right).not.toHaveBeenCalled();
  });

  it("is reset by touchcancel (interrupting call, system gesture)", () => {
    render(<Probe />);
    const area = screen.getByTestId("area");
    fireEvent.touchStart(area, { touches: [{ clientX: 250, clientY: 100 }] });
    fireEvent.touchCancel(area, {});
    fireEvent.touchEnd(area, { changedTouches: [{ clientX: 100, clientY: 100 }] });
    expect(left).not.toHaveBeenCalled();
  });
});
