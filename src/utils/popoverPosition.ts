/**
 * Positioning of the popover „at the click location" (cycle preview). Anchored below
 * (or above) the trigger, clamped to the viewport. Picks the side (above/below) by
 * where there's more room, and `maxHeight` = available space — shorter content shrinks
 * to the number of items, longer scrolls inside (nothing escapes the screen / gets
 * truncated). Pure function (no DOM) — easy to test.
 */

export interface AnchorRect {
  top: number;
  bottom: number;
  left: number;
  right: number;
  width: number;
}

export interface Viewport {
  width: number;
  height: number;
}

export interface PopoverPosition {
  left: number;
  width: number;
  placement: "below" | "above";
  /** px from the TOP of the viewport — set when placement === "below". */
  top?: number;
  /** px from the BOTTOM of the viewport — set when placement === "above". */
  bottom?: number;
  /** Upper height limit; a longer list scrolls inside. */
  maxHeight: number;
}

const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));

export function computePopoverPosition(
  anchor: AnchorRect,
  vp: Viewport,
  opts?: { width?: number; gap?: number; margin?: number; minHeight?: number },
): PopoverPosition {
  const margin = opts?.margin ?? 8;
  const gap = opts?.gap ?? 6;
  const minHeight = opts?.minHeight ?? 140;
  const width = Math.min(opts?.width ?? 380, vp.width - margin * 2);
  const left = clamp(anchor.left, margin, Math.max(margin, vp.width - width - margin));

  const spaceBelow = vp.height - anchor.bottom - gap - margin;
  const spaceAbove = anchor.top - gap - margin;

  if (spaceBelow >= spaceAbove) {
    return { left, width, placement: "below", top: anchor.bottom + gap, maxHeight: Math.max(minHeight, spaceBelow) };
  }
  return { left, width, placement: "above", bottom: vp.height - anchor.top + gap, maxHeight: Math.max(minHeight, spaceAbove) };
}
