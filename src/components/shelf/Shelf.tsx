import React, { useLayoutEffect, useRef, useState } from "react";
import { BookIndexEntry } from "../../types";
import { ShelfId, ShelfSlot, spineStyle, planShelf, layoutStack, SHELF_ROW_H, SHELF_ROW_GAP, SHELF_PLANK_H } from "../../utils/bookshelf";
import { PackItem, packAndLayout } from "../../utils/shelfPacking";
import { BookSpine } from "./BookSpine";
import { BookStack } from "./BookStack";
import { ShelfFrame, ShelfAccent } from "./ShelfFrame";

interface Props {
  shelfId: ShelfId;
  title: string;
  icon: React.ReactNode;
  accent: Extract<ShelfAccent, "emerald" | "cyan">;
  books: BookIndexEntry[];
  onDragStart: (book: BookIndexEntry) => void;
  onDragEnd: () => void;
  onDropBook: (target: ShelfId) => void;
  dragging: boolean;
}

const PLANK_STYLE: React.CSSProperties = {
  height: SHELF_PLANK_H,
  background: "linear-gradient(180deg, rgba(255,214,160,.45) 0, #5a3a1e 1px, #3a2413 55%, #1c1108 100%)",
  boxShadow: "0 8px 14px -6px rgba(0,0,0,.75)",
  borderRadius: 2,
};

/** Jeden regał: drewniany korpus + FIZYCZNE rozłożenie woluminów (wypełnione półki, oparte pochyły). */
export const Shelf: React.FC<Props> = ({ shelfId, title, icon, accent, books, onDragStart, onDragEnd, onDropBook, dragging }) => {
  const [over, setOver] = useState(false);
  const wellRef = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(0);

  useLayoutEffect(() => {
    const el = wellRef.current;
    if (!el) return;
    const update = () => setWidth(el.clientWidth);
    update();
    const ro = new ResizeObserver(update);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const rootProps: React.HTMLAttributes<HTMLDivElement> = {
    onDragOver: (e) => { e.preventDefault(); e.dataTransfer.dropEffect = "move"; if (!over) setOver(true); },
    onDragLeave: (e) => { if (!e.currentTarget.contains(e.relatedTarget as Node)) setOver(false); },
    onDrop: (e) => { e.preventDefault(); setOver(false); onDropBook(shelfId); },
  };

  const slots = planShelf(books);
  const slotByKey = new Map<string, ShelfSlot>();
  const items: PackItem[] = slots.map((slot) => {
    if (slot.kind === "stack") {
      const key = `stack:${slot.books[0].id}`;
      slotByKey.set(key, slot);
      const sl = layoutStack(slot.books);
      return { key, kind: "stack", bw: sl.cellW, h: sl.height, leanDir: 0 };
    }
    slotByKey.set(slot.book.id, slot);
    const st = spineStyle(slot.book);
    return { key: slot.book.id, kind: "spine", bw: st.width, h: st.height, leanDir: Math.sign(slot.lean) as -1 | 0 | 1 };
  });

  const rows = width > 0 ? packAndLayout(items, { rowWidth: width }) : [];

  return (
    <ShelfFrame
      title={title} icon={icon} accent={accent} count={books.length}
      highlight={over ? "target" : dragging ? "dragging" : "idle"}
      headerExtra={dragging ? <span className="text-[10px] uppercase tracking-widest text-amber-200/70 font-bold">upuść tutaj</span> : null}
      rootProps={rootProps}
    >
      {books.length === 0 ? (
        <div className="min-h-[140px] flex items-center justify-center text-xs text-slate-500 italic">
          {dragging ? "Upuść wolumin, aby przenieść" : "Pusto na tej półce"}
        </div>
      ) : (
        <div ref={wellRef} className="flex flex-col" style={{ rowGap: SHELF_ROW_GAP - SHELF_PLANK_H }}>
          {rows.map((row, ri) => (
            <div key={ri}>
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
                      <BookSpine book={slot.book} style={spineStyle(slot.book)} onDragStart={onDragStart} onDragEnd={onDragEnd} />
                    </div>
                  );
                })}
              </div>
              <div style={PLANK_STYLE} />
            </div>
          ))}
        </div>
      )}
    </ShelfFrame>
  );
};
