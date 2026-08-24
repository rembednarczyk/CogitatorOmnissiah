import React from "react";
import { BookIndexEntry } from "../../types";
import { spineStyle, layoutStack, displayTitle, hasAward } from "../../utils/bookshelf";

interface Props {
  books: BookIndexEntry[];          // każda warstwa to OSOBNA prawdziwa książka
  onDragStart: (book: BookIndexEntry) => void;
  onDragEnd: () => void;
}

/**
 * Kupka leżących książek — każda warstwa to osobny wolumin z PEŁNĄ nazwą (max 2
 * linie). Ułożenie liczy `layoutStack`: sortowanie od największej (dół) do
 * najmniejszej (góra), wyrównanie do lewej / do prawej / (rzadko) symetryczne,
 * plus opcjonalny „chaos" (poziomy rozjazd warstw). Każda warstwa ma własny
 * kolor, znacznik nagrody i przeciąganie.
 */
export const BookStack: React.FC<Props> = ({ books, onDragStart, onDragEnd }) => {
  const { cellW, layers } = layoutStack(books);

  return (
    <div className="relative shrink-0 flex flex-col-reverse items-start" style={{ width: cellW }}>
      {layers.map(({ book, width, fontSize, thickness, lines, x }, i) => {
        const color = spineStyle(book).color;
        return (
          <div
            key={book.id}
            draggable
            onDragStart={(e) => { e.dataTransfer.setData("text/plain", book.id); e.dataTransfer.effectAllowed = "move"; onDragStart(book); }}
            onDragEnd={onDragEnd}
            title={`${displayTitle(book)}${book.author ? " — " + book.author : ""}${book.year ? " (" + book.year + ")" : ""}`}
            className="group/layer relative rounded-[2px] cursor-grab active:cursor-grabbing select-none transition-transform duration-150 hover:-translate-y-0.5"
            style={{
              height: thickness,
              width,
              marginLeft: x,
              marginBottom: i === 0 ? 0 : 1,
              background: `linear-gradient(0deg, rgba(0,0,0,.42) 0, ${color} 26%, ${color} 74%, rgba(255,255,255,.12) 100%)`,
              boxShadow: "inset 0 1.5px 0 rgba(255,255,255,.12), 0 2px 4px -1px rgba(0,0,0,.5)",
            }}
          >
            {/* Krawędź kartek (fore-edge) po prawej */}
            <span className="absolute top-[2px] bottom-[2px] right-[2px] w-[3px] rounded-[1px] bg-gradient-to-b from-amber-50/70 via-amber-100/40 to-amber-50/70" aria-hidden />
            {/* PEŁNY tytuł wzdłuż grzbietu — zawijany do max 2 linii zamiast poszerzania */}
            <span
              className={`absolute inset-y-0 right-3 flex items-center font-bold text-white/90 ${hasAward(book) ? "left-3.5" : "left-2"}`}
            >
              <span
                style={{
                  fontSize,
                  lineHeight: 1.08,
                  display: "-webkit-box",
                  WebkitBoxOrient: "vertical",
                  WebkitLineClamp: lines,
                  overflow: "hidden",
                  whiteSpace: lines === 1 ? "nowrap" : "normal",
                  textShadow: "0 1px 2px rgba(0,0,0,.55)",
                }}
              >
                {displayTitle(book)}
              </span>
            </span>
            {hasAward(book) && (
              <span className="absolute top-1/2 -translate-y-1/2 left-1 w-[7px] h-[7px] rounded-full bg-amber-400 shadow-[0_0_5px_rgba(251,191,36,.85)]" title="Nagroda / nominacja" />
            )}
          </div>
        );
      })}
    </div>
  );
};
