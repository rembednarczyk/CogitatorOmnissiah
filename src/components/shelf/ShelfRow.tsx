import React, { useMemo } from "react";
import { BookIndexEntry } from "../../types";
import { spineStyle, SHELF_ROW_H, SHELF_PLANK_H } from "../../utils/bookshelf";
import { RenderSlot, assignDividerPlacement } from "../../utils/shelfLayout";
import { PlacedItem } from "../../utils/shelfPacking";
import { BookSpine } from "./BookSpine";
import { BookStack } from "./BookStack";
import { ShelfDivider } from "./ShelfDivider";

export const PLANK_STYLE: React.CSSProperties = {
  height: SHELF_PLANK_H,
  background: "var(--sk-plank-bg)",
  boxShadow: "0 8px 14px -6px rgba(0,0,0,.75)",
  borderRadius: 2,
};

/**
 * A precise-drop gap: `beforeId` = insert before this book; `afterId`
 * (the last boundary of the row) = insert after this book — Shelf maps it to the `beforeId`
 * of the successor in the global sequence (or the end of the shelf).
 */
export interface GapBoundary {
  x: number;
  beforeId?: string;
  afterId?: string;
}

/** Insertion caret (state held in Shelf; the row draws its own fragment). */
export interface GapCaret {
  row: number;
  x: number;
  valid: boolean;
}

interface Props {
  row: PlacedItem[];
  slotByKey: Map<string, RenderSlot>;
  /** Track (well) width — to detect plates extending past the right edge. */
  rowWidth: number;
  /** Row index on the page (addressing the insertion caret). */
  rowIndex: number;
  /** Precise drop active (knob enabled + dragging in progress). */
  preciseActive: boolean;
  /** Insertion caret, if it points to this row. */
  caret: GapCaret | null;
  /** Hovering over a gap (row, boundary) / leaving the row / dropping into the caret. */
  onGapOver: (rowIndex: number, boundary: GapBoundary) => void;
  onGapLeave: () => void;
  onGapDrop: () => boolean; // true = handled precisely (stop propagation)
  onDragStart: (book: BookIndexEntry) => void;
  onDragEnd: () => void;
}

/** One shelf row: volumes at physics-computed positions + a wooden plank underneath. */
export const ShelfRow: React.FC<Props> = ({ row, slotByKey, rowWidth, rowIndex, preciseActive, caret, onGapOver, onGapLeave, onGapDrop, onDragStart, onDragEnd }) => {
  // Placement of decade plates (top/bottom + left/right) — avoids collisions and going off the shelf.
  const placement = assignDividerPlacement(row, (k) => {
    const s = slotByKey.get(k);
    return s && s.kind === "divider" ? s.label : undefined;
  }, rowWidth);

  // Gap boundaries: start of each book slot (insert before the slot's first volume;
  // a stack = one slot) + right edge of the last slot (insert after the last one).
  const boundaries = useMemo<GapBoundary[]>(() => {
    const items = row.filter((p) => p.kind !== "divider").slice().sort((a, b) => a.x - b.x);
    const out: GapBoundary[] = [];
    for (const p of items) {
      const slot = slotByKey.get(p.key)!;
      const firstId = slot.kind === "stack" ? slot.books[0]?.id : slot.kind === "spine" ? slot.book.id : undefined;
      if (firstId) out.push({ x: p.x, beforeId: firstId });
    }
    const last = items[items.length - 1];
    if (last) {
      const slot = slotByKey.get(last.key)!;
      const lastId = slot.kind === "stack" ? slot.books[slot.books.length - 1]?.id : slot.kind === "spine" ? slot.book.id : undefined;
      if (lastId) out.push({ x: last.x + last.w, afterId: lastId });
    }
    return out;
  }, [row, slotByKey]);

  const rowCaret = caret && caret.row === rowIndex ? caret : null;

  const dragHandlers = preciseActive ? {
    onDragOver: (e: React.DragEvent<HTMLDivElement>) => {
      if (boundaries.length === 0) return;
      e.preventDefault(); // gaps accept the drop (no stopPropagation — the frame keeps highlighting the target)
      const x = e.clientX - e.currentTarget.getBoundingClientRect().left;
      let nearest = boundaries[0];
      for (const b of boundaries) if (Math.abs(b.x - x) < Math.abs(nearest.x - x)) nearest = b;
      onGapOver(rowIndex, nearest);
    },
    onDragLeave: (e: React.DragEvent<HTMLDivElement>) => {
      if (!e.currentTarget.contains(e.relatedTarget as Node)) onGapLeave();
    },
    onDrop: (e: React.DragEvent<HTMLDivElement>) => {
      // Handled precisely → stop (otherwise the frame does the global drop a second time).
      if (onGapDrop()) { e.preventDefault(); e.stopPropagation(); }
    },
  } : {};

  return (
  <div>
    <div className="relative" style={{ height: SHELF_ROW_H }} {...dragHandlers}>
      {/* Layer 1: spines/stacks + divider boards (z-20, above the background and plank). */}
      {row.map((p) => {
        const slot = slotByKey.get(p.key)!;
        if (slot.kind === "divider") {
          const pl = placement.get(p.key);
          return (
            <div key={p.key} className="absolute bottom-0" style={{ left: p.x, zIndex: 20 }}>
              <ShelfDivider part="board" label={slot.label} width={p.w} plate={pl?.level ?? "top"} dir={pl?.dir ?? "right"} />
            </div>
          );
        }
        if (slot.kind === "stack") {
          return (
            <div key={p.key} className="absolute bottom-0" style={{ left: p.x }}>
              <BookStack books={slot.books} onDragStart={onDragStart} onDragEnd={onDragEnd} />
            </div>
          );
        }
        return (
          <div
            key={p.key}
            className="absolute bottom-0"
            style={p.deg
              ? { left: p.x, transform: `rotate(${p.deg}deg)`, transformOrigin: p.deg > 0 ? "bottom right" : "bottom left" }
              : { left: p.x }}
          >
            <BookSpine book={slot.book} style={{ ...spineStyle(slot.book), width: p.w }} onDragStart={onDragStart} onDragEnd={onDragEnd} />
          </div>
        );
      })}
      {/* Layer 2: just the decade plates — ALWAYS on top (z-40), never under a neighbor's board. */}
      {row.map((p) => {
        const slot = slotByKey.get(p.key)!;
        if (slot.kind !== "divider") return null;
        const pl = placement.get(p.key);
        return (
          <div key={`plate-${p.key}`} className="absolute bottom-0" style={{ left: p.x, zIndex: 40 }}>
            <ShelfDivider part="plate" label={slot.label} width={p.w} plate={pl?.level ?? "top"} dir={pl?.dir ?? "right"} />
          </div>
        );
      })}
      {/* Insertion caret — a neon line at the nearest gap (cyan = OK, pink = wrong decade). */}
      {rowCaret && (
        <div
          className="absolute pointer-events-none rounded-[2px]"
          style={{
            left: rowCaret.x - 1.5, width: 3, top: 4, bottom: 0, zIndex: 50,
            background: rowCaret.valid
              ? "linear-gradient(180deg, rgba(34,211,238,.95), rgba(34,211,238,.25))"
              : "linear-gradient(180deg, rgba(244,63,94,.9), rgba(244,63,94,.2))",
            boxShadow: rowCaret.valid ? "0 0 10px rgba(34,211,238,.8)" : "0 0 10px rgba(244,63,94,.7)",
          }}
          aria-hidden
        />
      )}
    </div>
    <div style={PLANK_STYLE} />
  </div>
  );
};

/** Empty shelf row (to align the shelf's fixed height) — just the plank. */
export const EmptyShelfRow: React.FC = () => (
  <div>
    <div style={{ height: SHELF_ROW_H }} />
    <div style={PLANK_STYLE} />
  </div>
);
