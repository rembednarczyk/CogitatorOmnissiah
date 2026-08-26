import { BookIndexEntry } from "../types";
import { decadeKeyOf, effShelfKey } from "./bookshelf";

/**
 * Pure planner for precise insertion onto the Regał.
 *
 * Input: the sorted sequence of the target shelf WITHOUT the dragged book,
 * the dragged book and the target (`insertBeforeId` — id of the book we insert
 * before; null = at the very end of the shelf). Output: a batch of `ShelfOrder`
 * writes (fractional-years scale) — usually 1 entry (a midpoint key between
 * neighbors); on a key tie (books from the same year without manual keys) only
 * the BOUND range is renumbered, not the whole decade.
 *
 * Year validation: you can only insert into a gap whose neighbor (left or
 * right) belongs to the dragged book's decade — i.e. inside its section or
 * at its edges. „bez daty" books have no scale → precise drop off.
 */

export interface InsertionPlan {
  /** ShelfOrder writes to send (id → key). Always includes the dragged book. */
  orders: { pageId: string; order: number }[];
}

/** Max write batch (consistent with the POST /api/shelf-order limit). */
const MAX_ORDERS = 40;

/** Will the gap BEFORE book `insertBeforeId` (null = end) accept this book (decade matches)? */
export function canInsertAt(seq: BookIndexEntry[], dragged: BookIndexEntry, insertBeforeId: string | null): boolean {
  const dec = decadeKeyOf(dragged);
  if (!isFinite(dec)) return false; // „bez daty" — no ordering scale
  const idx = insertBeforeId === null ? seq.length : seq.findIndex((b) => b.id === insertBeforeId);
  if (insertBeforeId !== null && idx < 0) return false;
  const L = idx > 0 ? seq[idx - 1] : undefined;
  const R = idx < seq.length ? seq[idx] : undefined;
  if (!L && !R) return true; // empty shelf — plain drop, no key
  return (L !== undefined && decadeKeyOf(L) === dec) || (R !== undefined && decadeKeyOf(R) === dec);
}

/**
 * Write plan for the insertion. `null` when the gap is invalid (wrong decade /
 * unknown target / batch over limit) — the caller falls back to a plain drop.
 */
export function planInsertion(seq: BookIndexEntry[], dragged: BookIndexEntry, insertBeforeId: string | null): InsertionPlan | null {
  if (!canInsertAt(seq, dragged, insertBeforeId)) return null;
  const dec = decadeKeyOf(dragged);
  const idx = insertBeforeId === null ? seq.length : seq.findIndex((b) => b.id === insertBeforeId);
  const L = idx > 0 ? seq[idx - 1] : undefined;
  const R = idx < seq.length ? seq[idx] : undefined;

  if (!L && !R) return { orders: [] }; // empty shelf — position follows from the year

  // Bounds only from neighbors INSIDE the decade; a neighbor from another decade = open section edge.
  const kL = L && decadeKeyOf(L) === dec ? effShelfKey(L) : null;
  const kR = R && decadeKeyOf(R) === dec ? effShelfKey(R) : null;

  const lo = dec;            // lower edge of the decade scale
  const hi = dec + 9.99;     // upper edge (key must stay < dec+10)

  if (kL !== null && kR !== null) {
    if (kL < kR) return { orders: [{ pageId: dragged.id, order: (kL + kR) / 2 }] };
    // Key tie (same year without manual keys): renumber the bound range
    // [all consecutive entries with key == kL around the gap] + the inserted one.
    const tie = kL;
    let start = idx - 1;
    while (start - 1 >= 0 && decadeKeyOf(seq[start - 1]) === dec && effShelfKey(seq[start - 1]) === tie) start--;
    let end = idx; // first index PAST the range
    while (end < seq.length && decadeKeyOf(seq[end]) === dec && effShelfKey(seq[end]) === tie) end++;
    const run = seq.slice(start, end);
    const insertPos = idx - start;
    const finalRun: BookIndexEntry[] = [...run.slice(0, insertPos), dragged, ...run.slice(insertPos)];
    if (finalRun.length > MAX_ORDERS) return null;
    // Distribute keys in [tie, min(tie+0.98, hi)] — below the next year.
    const top = Math.min(tie + 0.98, hi);
    const stepSpan = top - tie;
    const orders = finalRun.map((b, i) => ({ pageId: b.id, order: tie + (stepSpan * (i + 1)) / (finalRun.length + 1) }));
    return { orders };
  }

  if (kL !== null) {
    // End of the decade section — key between kL and the upper edge.
    return { orders: [{ pageId: dragged.id, order: kL + (hi - kL) / 2 }] };
  }
  // kR !== null: start of the section — key between the lower edge and kR.
  return { orders: [{ pageId: dragged.id, order: lo + ((kR as number) - lo) / 2 }] };
}
