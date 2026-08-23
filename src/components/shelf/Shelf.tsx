import React, { useState } from "react";
import { BookIndexEntry } from "../../types";
import { ShelfId, spineStyle, planShelf, leanLayout, shelfPlankBackground, SHELF_ROW_H, SHELF_ROW_GAP } from "../../utils/bookshelf";
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
  /** Czy trwa przeciąganie (do podświetlenia stref upuszczenia). */
  dragging: boolean;
}

const PLANK_BG = shelfPlankBackground();

/** Jeden regał = drewniany korpus + drop-target z grzbietami/kupkami na deskach (wszystkie, bez przewijania). */
export const Shelf: React.FC<Props> = ({ shelfId, title, icon, accent, books, onDragStart, onDragEnd, onDropBook, dragging }) => {
  const [over, setOver] = useState(false);

  const rootProps: React.HTMLAttributes<HTMLDivElement> = {
    onDragOver: (e) => { e.preventDefault(); e.dataTransfer.dropEffect = "move"; if (!over) setOver(true); },
    onDragLeave: (e) => { if (!e.currentTarget.contains(e.relatedTarget as Node)) setOver(false); },
    onDrop: (e) => { e.preventDefault(); setOver(false); onDropBook(shelfId); },
  };

  const slots = planShelf(books);

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
        <div
          className="flex flex-wrap items-end justify-start"
          style={{ ...PLANK_BG, rowGap: `${SHELF_ROW_GAP}px`, columnGap: "5px" }}
        >
          {slots.map((slot) => {
            // Komórka o stałej wysokości toru → wszystkie zawinięte rzędy równe,
            // więc deska (tło) trafia dokładnie pod spód każdego z nich.
            if (slot.kind === "stack") {
              return (
                <div key={`stack:${slot.books[0].id}`} className="flex items-end justify-center shrink-0" style={{ height: SHELF_ROW_H }}>
                  <BookStack books={slot.books} onDragStart={onDragStart} onDragEnd={onDragEnd} />
                </div>
              );
            }
            const style = spineStyle(slot.book);
            const { cellW, shiftX } = leanLayout(style, slot.lean);
            return (
              <div key={slot.book.id} className="flex items-end justify-center shrink-0" style={{ height: SHELF_ROW_H, width: cellW }}>
                <div
                  style={slot.lean ? { transform: `translateX(${shiftX}px) rotate(${slot.lean}deg)`, transformOrigin: "bottom center" } : undefined}
                >
                  <BookSpine book={slot.book} style={style} onDragStart={onDragStart} onDragEnd={onDragEnd} />
                </div>
              </div>
            );
          })}
        </div>
      )}
    </ShelfFrame>
  );
};
