import React from "react";
import { BookIndexEntry } from "../../types";
import { ShelfSlot, spineStyle, SHELF_ROW_H, SHELF_PLANK_H } from "../../utils/bookshelf";
import { PlacedItem } from "../../utils/shelfPacking";
import { BookSpine } from "./BookSpine";
import { BookStack } from "./BookStack";

export const PLANK_STYLE: React.CSSProperties = {
  height: SHELF_PLANK_H,
  background: "linear-gradient(180deg, rgba(255,214,160,.45) 0, #5a3a1e 1px, #3a2413 55%, #1c1108 100%)",
  boxShadow: "0 8px 14px -6px rgba(0,0,0,.75)",
  borderRadius: 2,
};

interface Props {
  row: PlacedItem[];
  slotByKey: Map<string, ShelfSlot>;
  onDragStart: (book: BookIndexEntry) => void;
  onDragEnd: () => void;
}

/** Jeden rząd półki: woluminy na pozycjach z fizyki + drewniana deska pod spodem. */
export const ShelfRow: React.FC<Props> = ({ row, slotByKey, onDragStart, onDragEnd }) => (
  <div>
    <div className="relative" style={{ height: SHELF_ROW_H }}>
      {row.map((p) => {
        const slot = slotByKey.get(p.key)!;
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

/** Pusta półka (dla wyrównania stałej wysokości regału) — sama deska. */
export const EmptyShelfRow: React.FC = () => (
  <div>
    <div style={{ height: SHELF_ROW_H }} />
    <div style={PLANK_STYLE} />
  </div>
);
