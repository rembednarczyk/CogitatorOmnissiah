import React from "react";
import { BookIndexEntry } from "../../types";
import { SpineStyle, displayTitle, hasAward } from "../../utils/bookshelf";

interface Props {
  book: BookIndexEntry;
  style: SpineStyle;
  onDragStart: (book: BookIndexEntry) => void;
  onDragEnd: () => void;
}

/** Grzbiet książki (koncept A) — przeciągalny element regału. */
export const BookSpine: React.FC<Props> = ({ book, style, onDragStart, onDragEnd }) => (
  <div
    draggable
    onDragStart={(e) => { e.dataTransfer.setData("text/plain", book.id); e.dataTransfer.effectAllowed = "move"; onDragStart(book); }}
    onDragEnd={onDragEnd}
    title={`${displayTitle(book)}${book.author ? " — " + book.author : ""}${book.year ? " (" + book.year + ")" : ""}`}
    className="group relative shrink-0 flex items-center justify-center cursor-grab active:cursor-grabbing select-none rounded-[3px_3px_1px_1px] transition-transform duration-150 hover:-translate-y-3"
    style={{
      width: style.width,
      height: style.height,
      background: `linear-gradient(90deg, rgba(0,0,0,.35), ${style.color} 22%, ${style.color} 78%, rgba(0,0,0,.28))`,
      boxShadow: "inset 1.5px 0 0 rgba(255,255,255,.14), inset -2px 0 4px rgba(0,0,0,.45), 0 6px 10px -6px rgba(0,0,0,.6)",
    }}
  >
    <span className="absolute left-0 right-0 h-[10px] top-[9px] bg-black/25" aria-hidden />
    <span
      className="font-bold text-[10px] text-white/85 whitespace-nowrap overflow-hidden max-h-[80%] py-1.5"
      style={{ writingMode: "vertical-rl", transform: "rotate(180deg)", textShadow: "0 1px 2px rgba(0,0,0,.5)" }}
    >
      {displayTitle(book)}
    </span>
    {hasAward(book) && (
      <span className="absolute bottom-[7px] left-1/2 -translate-x-1/2 w-[9px] h-[9px] rounded-full bg-amber-400 shadow-[0_0_6px_rgba(251,191,36,.85)]" title="Nagroda / nominacja" />
    )}
  </div>
);
