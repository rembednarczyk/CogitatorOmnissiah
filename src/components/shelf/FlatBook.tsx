import React from "react";
import { BookIndexEntry } from "../../types";
import { SpineStyle, SpinePose, CLOTH_PALETTE, displayTitle, hasAward } from "../../utils/bookshelf";

interface Props {
  book: BookIndexEntry;
  style: SpineStyle;             // kolor bazowy + grubość grzbietu (wysokość leżącej książki)
  pose: Extract<SpinePose, { kind: "flat" }>;
  onDragStart: (book: BookIndexEntry) => void;
  onDragEnd: () => void;
}

function hash(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0;
  return h;
}

/**
 * Książka (lub mały stosik książek) leżąca na płask na desce — pozioma bryła
 * z widoczną krawędzią kartek u góry. Przeciągalna tak samo jak grzbiet.
 */
export const FlatBook: React.FC<Props> = ({ book, style, pose, onDragStart, onDragEnd }) => {
  const base = hash(displayTitle(book));
  const layerH = Math.max(14, Math.min(22, style.width));   // grubość jednej książki
  return (
    <div
      draggable
      onDragStart={(e) => { e.dataTransfer.setData("text/plain", book.id); e.dataTransfer.effectAllowed = "move"; onDragStart(book); }}
      onDragEnd={onDragEnd}
      title={`${displayTitle(book)}${book.author ? " — " + book.author : ""}${book.year ? " (" + book.year + ")" : ""}`}
      className="group relative shrink-0 cursor-grab active:cursor-grabbing select-none transition-transform duration-150 hover:-translate-y-1.5 flex flex-col-reverse items-start"
      style={{ width: pose.w }}
    >
      {Array.from({ length: pose.layers }).map((_, i) => {
        const c = CLOTH_PALETTE[(base + i * 7) % CLOTH_PALETTE.length];
        return (
          <div
            key={i}
            className="relative rounded-[2px]"
            style={{
              height: layerH,
              width: pose.w - i * 6,
              marginLeft: i * 3,
              marginBottom: i === 0 ? 0 : 1,
              background: `linear-gradient(0deg, rgba(0,0,0,.4) 0, ${c} 26%, ${c} 74%, rgba(255,255,255,.10) 100%)`,
              boxShadow: "inset 0 1.5px 0 rgba(255,255,255,.12), 0 2px 4px -1px rgba(0,0,0,.5)",
            }}
          >
            {/* Krawędź kartek (fore-edge) po prawej */}
            <span className="absolute top-[2px] bottom-[2px] right-[2px] w-[3px] rounded-[1px] bg-gradient-to-b from-amber-50/70 via-amber-100/40 to-amber-50/70" aria-hidden />
            {/* Tytuł tylko na wierzchniej książce stosu */}
            {i === pose.layers - 1 && (
              <span className="absolute inset-y-0 left-2 right-3 flex items-center text-[9px] font-bold text-white/85 truncate" style={{ textShadow: "0 1px 2px rgba(0,0,0,.5)" }}>
                {displayTitle(book)}
              </span>
            )}
          </div>
        );
      })}
      {hasAward(book) && (
        <span className="absolute -top-1 right-1 w-[8px] h-[8px] rounded-full bg-amber-400 shadow-[0_0_6px_rgba(251,191,36,.85)] z-10" title="Nagroda / nominacja" />
      )}
    </div>
  );
};
