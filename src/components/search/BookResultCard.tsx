import React from "react";
import { motion } from "motion/react";
import { Layers, BookMarked } from "lucide-react";
import { BookIndexEntry } from "../../types";
import { HighlightedText } from "./HighlightedText";

/** Kolor tagu źródła — spójny język wizualny z resztą aplikacji. */
function zrodloTheme(tag: string): string {
  const t = tag.toLowerCase();
  if (t.includes("posiadam")) return "bg-emerald-500/10 border-emerald-500/25 text-emerald-300";
  if (t.includes("przeczytane")) return "bg-cyan-500/10 border-cyan-500/25 text-cyan-300";
  if (t.includes("biblioteka")) return "bg-indigo-500/10 border-indigo-500/25 text-indigo-300";
  if (t.includes("vinted")) return "bg-rose-500/10 border-rose-500/25 text-rose-300";
  return "bg-slate-500/10 border-slate-500/25 text-slate-400";
}

/** Nagroda vs Nominacja — złoto dla zwycięstwa, chłodniej dla nominacji. */
function awardTheme(award: string): string {
  return award.toLowerCase().startsWith("nagroda")
    ? "bg-amber-500/10 border-amber-500/25 text-amber-300"
    : "bg-violet-500/10 border-violet-500/25 text-violet-300";
}

interface Props {
  book: BookIndexEntry;
  query: string;
}

export const BookResultCard: React.FC<Props> = ({ book, query }) => {
  const showOrig = book.origTitle && book.origTitle.trim() && book.origTitle !== book.plTitle;

  return (
    <motion.div
      layout
      initial={{ opacity: 0, scale: 0.97 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.97 }}
      transition={{ duration: 0.18 }}
      className="glass-card rounded-3xl p-5 border-cyan-500/10 hover:border-cyan-500/25 transition-colors group"
    >
      <div className="flex items-start gap-3">
        <div className="shrink-0 mt-0.5 p-2 rounded-xl bg-cyan-500/10 border border-cyan-500/15 text-cyan-400/80 group-hover:text-cyan-300 transition-colors">
          <BookMarked className="w-4 h-4" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <HighlightedText
              text={book.plTitle}
              query={query}
              className="text-base font-bold text-slate-100 leading-tight"
            />
            {book.partOfCycle && (
              <span
                className="shrink-0 flex items-center gap-0.5 px-1.5 py-0.5 rounded-md bg-amber-500/15 border border-amber-500/30 text-amber-300 text-[9px] font-bold uppercase tracking-wider"
                title="Część cyklu — może być kolejnym tomem w kolekcji"
              >
                <Layers className="w-2.5 h-2.5" /> cykl
              </span>
            )}
          </div>

          {showOrig && (
            <HighlightedText
              text={book.origTitle}
              query={query}
              className="block text-xs text-slate-500 italic mt-0.5"
            />
          )}

          <div className="text-[11px] text-slate-400 uppercase font-bold tracking-[0.15em] mt-1.5">
            <HighlightedText text={book.author || "—"} query={query} />
            {book.year ? <span className="text-slate-600"> · {book.year}</span> : null}
            {book.series ? <span className="text-slate-600 normal-case tracking-normal italic"> · {book.series}</span> : null}
          </div>

          {(book.awards.length > 0 || book.zrodlo.length > 0) && (
            <div className="flex flex-wrap gap-1.5 mt-3">
              {book.awards.map((a, i) => (
                <span key={`a${i}`} className={`px-2 py-0.5 rounded-full border text-[9px] font-bold uppercase tracking-wider ${awardTheme(a)}`}>
                  {a}
                </span>
              ))}
              {book.zrodlo.map((z, i) => (
                <span key={`z${i}`} className={`px-2 py-0.5 rounded-full border text-[9px] font-bold uppercase tracking-wider ${zrodloTheme(z)}`}>
                  {z}
                </span>
              ))}
            </div>
          )}
        </div>
      </div>
    </motion.div>
  );
};
