import React, { useState } from "react";
import { BookIndexEntry } from "../../types";
import { ShelfId, spineStyle } from "../../utils/bookshelf";
import { BookSpine } from "./BookSpine";

interface Props {
  shelfId: ShelfId;
  title: string;
  icon: React.ReactNode;
  accent: "emerald" | "cyan";
  books: BookIndexEntry[];
  onDragStart: (book: BookIndexEntry) => void;
  onDragEnd: () => void;
  onDropBook: (target: ShelfId) => void;
  /** Czy trwa przeciąganie (do podświetlenia stref upuszczenia). */
  dragging: boolean;
}

const ACCENT = {
  emerald: { text: "text-emerald-300", ring: "border-emerald-500/40", glow: "shadow-[0_0_24px_rgba(52,211,153,.18)]", chip: "bg-emerald-500/10 border-emerald-500/25 text-emerald-300" },
  cyan: { text: "text-cyan-300", ring: "border-cyan-500/40", glow: "shadow-[0_0_24px_rgba(34,211,238,.18)]", chip: "bg-cyan-500/10 border-cyan-500/25 text-cyan-300" },
};

/** Jeden regał = drop-target z półkami grzbietów (zawijanymi w rzędy). */
export const Shelf: React.FC<Props> = ({ shelfId, title, icon, accent, books, onDragStart, onDragEnd, onDropBook, dragging }) => {
  const [over, setOver] = useState(false);
  const a = ACCENT[accent];

  return (
    <div
      onDragOver={(e) => { e.preventDefault(); e.dataTransfer.dropEffect = "move"; if (!over) setOver(true); }}
      onDragLeave={(e) => { if (!e.currentTarget.contains(e.relatedTarget as Node)) setOver(false); }}
      onDrop={(e) => { e.preventDefault(); setOver(false); onDropBook(shelfId); }}
      className={`rounded-3xl border p-4 sm:p-5 bg-gradient-to-b from-amber-950/30 to-black/40 transition-colors ${
        over ? `${a.ring} ${a.glow}` : dragging ? "border-white/15 border-dashed" : "border-amber-900/40"
      }`}
    >
      <div className="flex items-center gap-2 mb-4">
        <span className={a.text}>{icon}</span>
        <h3 className="text-sm font-bold uppercase tracking-widest text-slate-200">{title}</h3>
        <span className={`px-2 py-0.5 rounded-lg text-[10px] font-bold border ${a.chip}`}>{books.length}</span>
        {dragging && <span className="ml-auto text-[10px] uppercase tracking-widest text-slate-500 font-bold">upuść tutaj</span>}
      </div>

      {books.length === 0 ? (
        <div className="min-h-[120px] flex items-center justify-center text-xs text-slate-600 italic">
          {dragging ? "Upuść wolumin, aby przenieść" : "Pusto na tej półce"}
        </div>
      ) : (
        <div className="flex flex-wrap items-end gap-[5px] content-end max-h-[520px] overflow-y-auto pr-1 custom-scrollbar">
          {books.map((b) => (
            <BookSpine key={b.id} book={b} style={spineStyle(b)} onDragStart={onDragStart} onDragEnd={onDragEnd} />
          ))}
        </div>
      )}
      {/* Deska półki */}
      <div className="h-4 rounded-[3px] mt-1 bg-gradient-to-b from-amber-800/70 via-amber-950/80 to-black shadow-[0_10px_16px_-6px_rgba(0,0,0,.7),inset_0_1px_0_rgba(255,220,170,.15)]" />
    </div>
  );
};
