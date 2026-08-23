import React from "react";
import { BookIndexEntry } from "../../types";
import { CLOTH_PALETTE, displayTitle } from "../../utils/bookshelf";

function hash(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0;
  return h;
}

/** Okładka „twarzą" (koncept B) — półka „Wyróżnione". Widok, bez drag&drop. */
export const CoverCard: React.FC<{ book: BookIndexEntry }> = ({ book }) => {
  const h = hash(displayTitle(book));
  const c1 = CLOTH_PALETTE[h % CLOTH_PALETTE.length];
  const c2 = CLOTH_PALETTE[(h >>> 3) % CLOTH_PALETTE.length];
  return (
    <div
      title={`${displayTitle(book)}${book.author ? " — " + book.author : ""}`}
      className="group relative shrink-0 w-[104px] h-[156px] rounded-[6px_3px_3px_6px] overflow-hidden flex flex-col justify-between p-3 pl-4 transition-transform duration-150 hover:-translate-y-2"
      style={{ background: `linear-gradient(150deg, ${c1}, ${c2})`, boxShadow: "inset -5px 0 8px -6px rgba(0,0,0,.6), 0 10px 16px -8px rgba(0,0,0,.7)" }}
    >
      <span className="absolute left-0 top-0 bottom-0 w-1.5 bg-black/25 shadow-[1px_0_2px_rgba(255,255,255,.1)]" aria-hidden />
      <span className="absolute top-2 right-2 w-4 h-4 rounded-full border-[1.5px] border-amber-300 text-amber-300 text-[9px] flex items-center justify-center">★</span>
      <div className="text-[12px] font-bold leading-tight text-white text-balance drop-shadow-[0_1px_3px_rgba(0,0,0,.5)]">
        {displayTitle(book)}
      </div>
      <div className="text-[8.5px] uppercase tracking-wider text-white/75 font-bold">
        {book.author}{book.year ? ` · ${book.year}` : ""}
      </div>
    </div>
  );
};
