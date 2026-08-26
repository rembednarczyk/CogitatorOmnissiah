/**
 * Pure helpers for stat-card ordering (drag&drop in „Analiza Zasobów").
 *
 * The user's order is kept as a list of section ids (`ui.statsOrder`). The code is
 * resilient to drift: new cards added in code that aren't in the saved list are
 * appended at the end in code order; ids from the save that no longer exist in code
 * are ignored. So the saved blob never „loses" or duplicates a card.
 */

/**
 * Determines the final id order: first the saved ones (filtered to existing,
 * no duplicates), then the rest from `allIds` in code order.
 */
export function orderByIds(allIds: string[], savedOrder: string[]): string[] {
  const known = new Set(allIds);
  const seen = new Set<string>();
  const out: string[] = [];
  for (const id of savedOrder) {
    if (known.has(id) && !seen.has(id)) { seen.add(id); out.push(id); }
  }
  for (const id of allIds) {
    if (!seen.has(id)) { seen.add(id); out.push(id); }
  }
  return out;
}

/**
 * Distributes items across `cols` columns round-robin (item i → column i % cols),
 * preserving „row by row" reading: 0 and 2 and 4 on the left, 1 and 3 and 5 on the right.
 * Each column then packs independently (no height coupling = no gaps),
 * while the reading order left→right, top→bottom stays 0,1,2,3,... Returns `cols` lists.
 */
export function distributeColumns<T>(items: T[], cols: number): T[][] {
  const n = Math.max(1, Math.floor(cols));
  const out: T[][] = Array.from({ length: n }, () => []);
  items.forEach((it, i) => out[i % n].push(it));
  return out;
}

/**
 * Moves `dragId` to the position of `targetId` (inserting before the target element at
 * its current place). Returns a new list; the input stays untouched.
 * No-op when either id doesn't exist or they're equal.
 */
export function moveId(order: string[], dragId: string, targetId: string): string[] {
  if (dragId === targetId) return order.slice();
  const from = order.indexOf(dragId);
  const to = order.indexOf(targetId);
  if (from === -1 || to === -1) return order.slice();
  const next = order.slice();
  next.splice(from, 1);
  const insertAt = next.indexOf(targetId);
  next.splice(insertAt, 0, dragId);
  return next;
}
