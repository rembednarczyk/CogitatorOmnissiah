import React from "react";
import { BookIndexEntry } from "../../types";
import { spineStyle, flatBookWidth, flatBookThickness, displayTitle, hasAward } from "../../utils/bookshelf";

interface Props {
  books: BookIndexEntry[];          // każda warstwa to OSOBNA prawdziwa książka
  onDragStart: (book: BookIndexEntry) => void;
  onDragEnd: () => void;
}

/** Deterministyczny drobny „luz" ułożenia warstwy (0–4 px), z tytułu. */
function jitter(book: BookIndexEntry): number {
  let h = 0;
  const s = displayTitle(book) || book.id;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0;
  return (h >>> 9) % 5;
}

/**
 * Kupka leżących książek — każda warstwa to osobny wolumin (własny kolor, tytuł
 * wzdłuż grzbietu, znacznik nagrody, przeciąganie). Renderowane od dołu do góry.
 */
export const BookStack: React.FC<Props> = ({ books, onDragStart, onDragEnd }) => {
  const layers = books.map((b) => ({
    book: b,
    w: flatBookWidth(b),
    h: flatBookThickness(spineStyle(b)),
    color: spineStyle(b).color,
    dx: jitter(b),
  }));
  const cellW = Math.max(...layers.map((l) => l.w + l.dx));

  return (
    <div className="relative shrink-0 flex flex-col-reverse items-start" style={{ width: cellW }}>
      {layers.map(({ book, w, h, color, dx }, i) => (
        <div
          key={book.id}
          draggable
          onDragStart={(e) => { e.dataTransfer.setData("text/plain", book.id); e.dataTransfer.effectAllowed = "move"; onDragStart(book); }}
          onDragEnd={onDragEnd}
          title={`${displayTitle(book)}${book.author ? " — " + book.author : ""}${book.year ? " (" + book.year + ")" : ""}`}
          className="group/layer relative rounded-[2px] cursor-grab active:cursor-grabbing select-none transition-transform duration-150 hover:-translate-x-1"
          style={{
            height: h,
            width: w,
            marginLeft: dx,
            marginBottom: i === 0 ? 0 : 1,
            background: `linear-gradient(0deg, rgba(0,0,0,.42) 0, ${color} 26%, ${color} 74%, rgba(255,255,255,.12) 100%)`,
            boxShadow: "inset 0 1.5px 0 rgba(255,255,255,.12), 0 2px 4px -1px rgba(0,0,0,.5)",
          }}
        >
          {/* Krawędź kartek (fore-edge) po prawej */}
          <span className="absolute top-[2px] bottom-[2px] right-[2px] w-[3px] rounded-[1px] bg-gradient-to-b from-amber-50/70 via-amber-100/40 to-amber-50/70" aria-hidden />
          {/* Tytuł wzdłuż grzbietu leżącej książki */}
          <span className="absolute inset-y-0 left-2 right-3 flex items-center text-[9px] font-bold text-white/85 truncate" style={{ textShadow: "0 1px 2px rgba(0,0,0,.5)" }}>
            {displayTitle(book)}
          </span>
          {hasAward(book) && (
            <span className="absolute top-1/2 -translate-y-1/2 left-1 w-[7px] h-[7px] rounded-full bg-amber-400 shadow-[0_0_5px_rgba(251,191,36,.85)]" title="Nagroda / nominacja" />
          )}
        </div>
      ))}
    </div>
  );
};
