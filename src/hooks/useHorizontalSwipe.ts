import { useRef, TouchEvent } from "react";

/**
 * Horizontal swipe gesture for touch devices — returns handlers to spread onto an element.
 *
 * The whole difficulty here is NOT detecting a swipe; it's not stealing gestures that
 * belong to the page:
 *
 *  - **Vertical scrolling wins.** A swipe counts only when the horizontal distance
 *    dominates the vertical one (`|dx| > |dy| * RATIO`), so an ordinary flick down the
 *    page never flips a shelf. We deliberately never call `preventDefault` on
 *    `touchmove` — that is what would actually block scrolling.
 *  - **Pinch-zoom is left alone.** A second finger cancels the gesture outright.
 *  - **A slow drag isn't a swipe.** Past `MAX_DURATION_MS` we assume the finger was
 *    resting or dragging, not flicking.
 *
 * Mouse drag&drop is untouched: this only listens to touch events, and HTML5 DnD is
 * mouse-driven anyway.
 */
const MIN_DISTANCE_PX = 50;
const DOMINANCE_RATIO = 1.4; // horizontal must beat vertical by this much
const MAX_DURATION_MS = 800;

interface Options {
  onSwipeLeft: () => void;
  onSwipeRight: () => void;
  /** When false the handlers are inert (e.g. only one page, or a drag in progress). */
  enabled?: boolean;
}

export function useHorizontalSwipe({ onSwipeLeft, onSwipeRight, enabled = true }: Options) {
  const start = useRef<{ x: number; y: number; t: number } | null>(null);

  const reset = () => { start.current = null; };

  return {
    onTouchStart: (e: TouchEvent) => {
      if (!enabled || e.touches.length !== 1) { reset(); return; }
      const t = e.touches[0];
      start.current = { x: t.clientX, y: t.clientY, t: Date.now() };
    },
    onTouchMove: (e: TouchEvent) => {
      // A second finger means pinch/zoom — hand the gesture back to the browser.
      if (e.touches.length > 1) reset();
    },
    onTouchEnd: (e: TouchEvent) => {
      const s = start.current;
      reset();
      if (!enabled || !s) return;

      const t = e.changedTouches[0];
      if (!t) return;
      const dx = t.clientX - s.x;
      const dy = t.clientY - s.y;

      if (Date.now() - s.t > MAX_DURATION_MS) return;
      if (Math.abs(dx) < MIN_DISTANCE_PX) return;
      if (Math.abs(dx) < Math.abs(dy) * DOMINANCE_RATIO) return; // vertical scroll wins

      if (dx < 0) onSwipeLeft(); else onSwipeRight();
    },
    onTouchCancel: reset,
  };
}
