import { useState } from "react";
import { moveId } from "../utils/statsLayout";
import { persistStatsOrder } from "./useAppConfig";

/**
 * Drag-and-drop reorder state for the stats card masonry: the "arranging" toggle,
 * the current drag/hover ids, and persistence of the new order. Kept out of
 * StatsSection so the section is composition only and StatsMasonry stays a pure
 * layout component driven by this state.
 */
export function useCardReorder() {
  const [arranging, setArranging] = useState(false);
  const [dragId, setDragId] = useState<string | null>(null);
  const [overId, setOverId] = useState<string | null>(null);

  const endDrag = () => { setDragId(null); setOverId(null); };
  const exit = () => { setArranging(false); endDrag(); };

  /** Persist the new order when `dragId` is dropped onto `target` (within `order`). */
  const commitReorder = (order: string[], target: string) => {
    if (!dragId || dragId === target) return;
    persistStatsOrder(moveId(order, dragId, target));
  };

  return {
    arranging,
    dragId,
    overId,
    startDrag: (id: string) => setDragId(id),
    hover: (id: string) => setOverId(id),
    endDrag,
    commitReorder,
    toggle: () => (arranging ? exit() : setArranging(true)),
    reset: () => persistStatsOrder([]),
  };
}

export type CardReorder = ReturnType<typeof useCardReorder>;
