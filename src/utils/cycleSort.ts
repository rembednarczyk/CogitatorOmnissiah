import { HarvestCycle } from "../hooks/useCyclesHarvest";

/**
 * Sortowanie kart „Archiwum Cykli":
 * - `easywins` — najmniej DO PRZECZYTANIA na górze (`total − read` rosnąco) → „szybkie
 *   zwycięstwa"; ukończone (przeczytane w całości) spadają na sam dół. Remis: mniej do
 *   zdobycia, potem nazwa.
 * - `acquire` — najwięcej BRAKÓW na górze (`missing` = ani posiadane, ani przeczytane) —
 *   dawne zachowanie (co jeszcze skompletować).
 * Czysta funkcja (zwraca kopię).
 */
export type CycleSortMode = "easywins" | "acquire";

const toRead = (c: HarvestCycle) => c.total - c.read;
const toAcquire = (c: HarvestCycle) => c.total - c.owned;
const isDone = (c: HarvestCycle) => c.total > 0 && c.read === c.total;

export function sortCycles(cycles: HarvestCycle[], mode: CycleSortMode): HarvestCycle[] {
  const copy = [...cycles];
  if (mode === "easywins") {
    return copy.sort((a, b) => {
      // Ukończone zawsze na dół (nic nie zostało do nadrobienia).
      if (isDone(a) !== isDone(b)) return isDone(a) ? 1 : -1;
      return toRead(a) - toRead(b) || toAcquire(a) - toAcquire(b) || a.cycle.localeCompare(b.cycle, "pl");
    });
  }
  return copy.sort((a, b) => b.missing - a.missing || b.total - a.total || a.cycle.localeCompare(b.cycle, "pl"));
}
