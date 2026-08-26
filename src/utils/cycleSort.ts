import { HarvestCycle } from "../hooks/useCyclesHarvest";

/**
 * Sorting of „Archiwum Cykli" cards:
 * - `easywins` — fewest TO READ on top (`total − read` ascending) → quick
 *   wins; completed (fully read) drop to the very bottom. Tie: fewer to
 *   acquire, then name.
 * - `acquire` — most MISSING on top (`missing` = neither owned nor read) —
 *   the old behavior (what's left to complete).
 * Pure function (returns a copy).
 */
export type CycleSortMode = "easywins" | "acquire";

const toRead = (c: HarvestCycle) => c.total - c.read;
const toAcquire = (c: HarvestCycle) => c.total - c.owned;
const isDone = (c: HarvestCycle) => c.total > 0 && c.read === c.total;

export function sortCycles(cycles: HarvestCycle[], mode: CycleSortMode): HarvestCycle[] {
  const copy = [...cycles];
  if (mode === "easywins") {
    return copy.sort((a, b) => {
      // Completed always at the bottom (nothing left to catch up on).
      if (isDone(a) !== isDone(b)) return isDone(a) ? 1 : -1;
      return toRead(a) - toRead(b) || toAcquire(a) - toAcquire(b) || a.cycle.localeCompare(b.cycle, "pl");
    });
  }
  return copy.sort((a, b) => b.missing - a.missing || b.total - a.total || a.cycle.localeCompare(b.cycle, "pl"));
}
