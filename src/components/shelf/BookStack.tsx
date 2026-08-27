import React from "react";
import { BookIndexEntry } from "../../types";
import { spineStyle, layoutStack, displayTitle, awardWins } from "../../utils/bookshelf";

interface Props {
  books: BookIndexEntry[];          // each layer is a SEPARATE real book
  onDragStart: (book: BookIndexEntry) => void;
  onDragEnd: () => void;
}

/**
 * A pile of lying books — each layer is a separate volume with its FULL title (max 2
 * lines). The arrangement is computed by `layoutStack`: sorting from largest (bottom) to
 * smallest (top), aligned left / right / (rarely) symmetric,
 * plus optional „chaos" (horizontal layer offset). Each layer has its own
 * color, award marker and dragging.
 */
export const BookStack: React.FC<Props> = ({ books, onDragStart, onDragEnd }) => {
  const { cellW, layers } = layoutStack(books);

  return (
    <div className="relative shrink-0 flex flex-col-reverse items-start" style={{ width: cellW }}>
      {layers.map(({ book, width, fontSize, thickness, lines, x }, i) => {
        const s = spineStyle(book);
        const wins = awardWins(book);
        return (
          <div
            key={book.id}
            draggable
            onDragStart={(e) => { e.dataTransfer.setData("text/plain", book.id); e.dataTransfer.effectAllowed = "move"; onDragStart(book); }}
            onDragEnd={onDragEnd}
            title={`${displayTitle(book)}${book.author ? " — " + book.author : ""}${book.year ? " (" + book.year + ")" : ""}`}
            className="stack-layer group/layer relative rounded-[2px] cursor-grab active:cursor-grabbing select-none transition-transform duration-150 hover:-translate-y-0.5"
            style={{
              height: thickness,
              width,
              marginLeft: x,
              marginBottom: i === 0 ? 0 : 1,
              ["--spine-muted" as string]: s.color,
              ["--spine-light" as string]: s.light,
              ["--spine-app" as string]: s.app,
              ["--spine-app-rgb" as string]: s.appRgb,
              boxShadow: "inset 0 1.5px 0 rgba(255,255,255,.12), 0 2px 4px -1px rgba(0,0,0,.5)",
            } as React.CSSProperties}
          >
            {/* Page edge (fore-edge) on the right */}
            <span className="fore-edge absolute top-[2px] bottom-[2px] right-[2px] w-[3px] rounded-[1px]" aria-hidden />
            {/* FULL title along the spine — wrapped to max 2 lines instead of widening */}
            <span
              className="spine-title absolute inset-y-0 right-3 flex items-center font-bold"
              style={{ left: wins.length ? 6 + wins.length * 7 : 8 }}
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
                }}
              >
                {displayTitle(book)}
              </span>
            </span>
            {wins.length > 0 && (
              <span className="absolute top-1/2 -translate-y-1/2 left-1 flex items-center gap-[2px]" title={wins.map((w) => w.label).join(" · ")}>
                {wins.map((w) => (
                  <span key={w.key} className="w-[6px] h-[6px] rounded-full" style={{ background: w.color, boxShadow: `0 0 5px ${w.color}` }} />
                ))}
              </span>
            )}
          </div>
        );
      })}
    </div>
  );
};
