import React, { useState, useEffect } from "react";
import { GripVertical } from "lucide-react";
import { orderByIds, distributeColumns } from "../../utils/statsLayout";
import { CardReorder } from "../../hooks/useCardReorder";

export interface StatCard {
  id: string;
  /** Full-width card (breaks the round-robin block, takes the whole width). */
  span2?: boolean;
  node: React.ReactNode;
}

type Segment = { kind: "full"; card: StatCard } | { kind: "block"; cards: StatCard[] };

/**
 * The stats card masonry: lays cards out "row by row" (round-robin across
 * `cols` columns that each pack independently, so no height coupling → no gaps),
 * with full-width (`span2`) cards breaking the block. Also renders the
 * drag-and-drop affordances in arranging mode. All DnD state comes from the
 * `reorder` hook — this component is layout only.
 */
export const StatsMasonry: React.FC<{ cards: StatCard[]; savedOrder: string[]; reorder: CardReorder }> = ({ cards, savedOrder, reorder }) => {
  // Column count follows the md breakpoint (768px) — round-robin reads "row by
  // row", so the columns must match what's visible.
  const [cols, setCols] = useState(2);
  useEffect(() => {
    const mq = window.matchMedia("(min-width: 768px)");
    const apply = () => setCols(mq.matches ? 2 : 1);
    apply();
    mq.addEventListener("change", apply);
    return () => mq.removeEventListener("change", apply);
  }, []);

  // Effective order (user's save + new cards at the end) and lookup by id.
  const order = orderByIds(cards.map((c) => c.id), savedOrder);
  const byId = new Map(cards.map((c) => [c.id, c]));
  const ordered = order.map((id) => byId.get(id)).filter((c): c is StatCard => Boolean(c));

  const { arranging, dragId, overId } = reorder;

  const renderCard = (card: StatCard) => {
    const dragging = dragId === card.id;
    const isOver = arranging && overId === card.id && !!dragId && dragId !== card.id;
    return (
      <div
        key={card.id}
        className={`relative ${arranging ? "cursor-move select-none" : ""} ${dragging ? "opacity-40" : ""}`}
        draggable={arranging}
        onDragStart={(e) => {
          if (!arranging) return;
          reorder.startDrag(card.id);
          e.dataTransfer.effectAllowed = "move";
          try { e.dataTransfer.setData("text/plain", card.id); } catch { /* Safari */ }
        }}
        onDragEnter={() => { if (arranging) reorder.hover(card.id); }}
        onDragOver={(e) => { if (arranging) e.preventDefault(); }}
        onDrop={(e) => { if (arranging) { e.preventDefault(); reorder.commitReorder(order, card.id); } }}
        onDragEnd={reorder.endDrag}
      >
        <div className={arranging ? "pointer-events-none" : ""}>{card.node}</div>
        {arranging && (
          <div className={`absolute inset-0 rounded-3xl border-2 border-dashed pointer-events-none transition-colors ${isOver ? "border-cyan-400/70 bg-cyan-500/5" : "border-amber-500/40"}`} />
        )}
        {arranging && !dragging && (
          <div className="absolute top-3 right-3 flex items-center gap-1 px-2 py-1 rounded-lg bg-slate-950/85 border border-amber-500/30 text-amber-300 text-[9px] font-bold uppercase tracking-widest pointer-events-none">
            <GripVertical className="w-3 h-3" /> przeciągnij
          </div>
        )}
      </div>
    );
  };

  // Full-width cards break the round-robin block and render at full width; the
  // rest go into columns (i % cols) with independent packing.
  const segments: Segment[] = [];
  let run: StatCard[] = [];
  for (const c of ordered) {
    if (c.span2) {
      if (run.length) { segments.push({ kind: "block", cards: run }); run = []; }
      segments.push({ kind: "full", card: c });
    } else {
      run.push(c);
    }
  }
  if (run.length) segments.push({ kind: "block", cards: run });

  return (
    <div className="space-y-8">
      {segments.map((seg, si) =>
        seg.kind === "full" ? (
          <div key={`full-${si}`}>{renderCard(seg.card)}</div>
        ) : (
          <div key={`block-${si}`} className="flex gap-8">
            {distributeColumns(seg.cards, cols).map((col, ci) => (
              <div key={ci} className="flex-1 min-w-0 flex flex-col gap-8">
                {col.map((card) => renderCard(card))}
              </div>
            ))}
          </div>
        )
      )}
    </div>
  );
};
