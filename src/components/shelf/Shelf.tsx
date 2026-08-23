import React, { useState } from "react";
import { BookIndexEntry } from "../../types";
import { ShelfId, spineStyle, spinePose, spineLayout, shelfPlankBackground, SHELF_ROW_H, SHELF_ROW_GAP } from "../../utils/bookshelf";
import { BookSpine } from "./BookSpine";
import { FlatBook } from "./FlatBook";
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

/** Jeden regał = drewniany korpus + drop-target z grzbietami na deskach (wszystkie, bez przewijania). */
export const Shelf: React.FC<Props> = ({ shelfId, title, icon, accent, books, onDragStart, onDragEnd, onDropBook, dragging }) => {
  const [over, setOver] = useState(false);

  const rootProps: React.HTMLAttributes<HTMLDivElement> = {
    onDragOver: (e) => { e.preventDefault(); e.dataTransfer.dropEffect = "move"; if (!over) setOver(true); },
    onDragLeave: (e) => { if (!e.currentTarget.contains(e.relatedTarget as Node)) setOver(false); },
    onDrop: (e) => { e.preventDefault(); setOver(false); onDropBook(shelfId); },
  };

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
          {books.map((b) => {
            const style = spineStyle(b);
            const pose = spinePose(b);
            const layout = spineLayout(style, pose);
            // Komórka ma stałą wysokość toru (deski się zgadzają) i szerokość
            // `cellW` = szerokość obróconego grzbietu, więc przechylona książka
            // mieści się w swoim torze i NIE nachodzi na sąsiada.
            return (
              <div key={b.id} className="flex items-end justify-center shrink-0" style={{ height: SHELF_ROW_H, width: layout.cellW }}>
                {pose.kind === "flat" ? (
                  <FlatBook book={b} style={style} pose={pose} onDragStart={onDragStart} onDragEnd={onDragEnd} />
                ) : (
                  <div
                    style={pose.kind === "lean"
                      ? { transform: `translateX(${layout.shiftX}px) rotate(${layout.rotate}deg)`, transformOrigin: "bottom center" }
                      : undefined}
                  >
                    <BookSpine book={b} style={style} onDragStart={onDragStart} onDragEnd={onDragEnd} />
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </ShelfFrame>
  );
};
