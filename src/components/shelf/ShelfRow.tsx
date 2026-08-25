import React from "react";
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

interface Props {
  row: PlacedItem[];
  slotByKey: Map<string, RenderSlot>;
  /** Szerokość toru (well) — do wykrycia tabliczek wychodzących poza prawą krawędź. */
  rowWidth: number;
  onDragStart: (book: BookIndexEntry) => void;
  onDragEnd: () => void;
}

/** Jeden rząd półki: woluminy na pozycjach z fizyki + drewniana deska pod spodem. */
export const ShelfRow: React.FC<Props> = ({ row, slotByKey, rowWidth, onDragStart, onDragEnd }) => {
  // Rozmieszczenie tabliczek dekad (góra/dół + lewo/prawo) — unika kolizji i wyjścia poza półkę.
  const placement = assignDividerPlacement(row, (k) => {
    const s = slotByKey.get(k);
    return s && s.kind === "divider" ? s.label : undefined;
  }, rowWidth);
  return (
  <div>
    <div className="relative" style={{ height: SHELF_ROW_H }}>
      {row.map((p) => {
        const slot = slotByKey.get(p.key)!;
        if (slot.kind === "divider") {
          // z-30: tabliczka + deseczka malują się PONAD grzbietami i deską półki.
          const pl = placement.get(p.key);
          return (
            <div key={p.key} className="absolute bottom-0" style={{ left: p.x, zIndex: 30 }}>
              <ShelfDivider label={slot.label} width={p.w} plate={pl?.level ?? "top"} dir={pl?.dir ?? "right"} />
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
    </div>
    <div style={PLANK_STYLE} />
  </div>
  );
};

/** Pusta półka (dla wyrównania stałej wysokości regału) — sama deska. */
export const EmptyShelfRow: React.FC = () => (
  <div>
    <div style={{ height: SHELF_ROW_H }} />
    <div style={PLANK_STYLE} />
  </div>
);
