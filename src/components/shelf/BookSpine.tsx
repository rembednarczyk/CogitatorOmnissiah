import React from "react";
import { BookIndexEntry } from "../../types";
import { SpineStyle, displayTitle, awardWins, spineFontSize } from "../../utils/bookshelf";

interface Props {
  book: BookIndexEntry;
  style: SpineStyle;
  onDragStart: (book: BookIndexEntry) => void;
  onDragEnd: () => void;
}

/** Sygnatura katalogowa holo (deterministyczna z id) — cyfrowy detal na grzbiecie. */
function catalogSig(id: string): string {
  let h = 0;
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) >>> 0;
  return "M" + (1000 + (h % 9000));
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
      boxShadow: "inset 1.5px 0 0 rgba(var(--noo-glow),.22), inset -2px 0 4px rgba(0,0,0,.45), 0 6px 10px -6px rgba(0,0,0,.6)",
    }}
  >
    <span className="absolute left-0 right-0 h-[10px] top-[9px] bg-black/25" aria-hidden />
    {style.width >= 26 && (
      <span
        className="absolute top-[3px] left-0 right-0 text-center font-mono pointer-events-none"
        style={{ fontSize: 6, letterSpacing: "0.03em", color: "rgba(var(--noo-glow),.85)", textShadow: "0 0 4px rgba(var(--noo-glow),.8)" }}
        aria-hidden
      >
        {catalogSig(book.id)}
      </span>
    )}
    <span
      className="font-bold text-white/85 whitespace-nowrap overflow-hidden max-h-[94%] py-1"
      style={{ fontSize: spineFontSize(style, displayTitle(book)), writingMode: "vertical-rl", transform: "rotate(180deg)", textShadow: "0 1px 2px rgba(0,0,0,.5)" }}
    >
      {displayTitle(book)}
    </span>
    {(() => {
      const wins = awardWins(book);
      if (!wins.length) return null;
      return (
        <span className="absolute bottom-[6px] left-1/2 -translate-x-1/2 flex flex-col-reverse items-center gap-[3px]" title={wins.map((w) => w.label).join(" · ")}>
          {wins.map((w) => (
            <span key={w.key} className="w-[8px] h-[8px] rounded-full" style={{ background: w.color, boxShadow: `0 0 6px ${w.color}, 0 0 0 1px rgba(var(--noo-glow),.5)` }} />
          ))}
        </span>
      );
    })()}
  </div>
);
