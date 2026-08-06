import React from "react";
import { motion } from "motion/react";
import { Library, ChevronDown, ChevronUp, CheckCircle2, Loader2 } from "lucide-react";
import { LibraryStat } from "../../hooks/useStats";

interface LibraryProgressItemProps {
  library: LibraryStat;
  onMarkAsRead: (pageId: string) => void;
  markingId: string | null;
}

export const LibraryProgressItem: React.FC<LibraryProgressItemProps> = ({ library, onMarkAsRead, markingId }) => {
  const [isExpanded, setIsExpanded] = React.useState(true);

  return (
    <div className="space-y-4">
      <button
        type="button"
        onClick={() => setIsExpanded(!isExpanded)}
        aria-expanded={isExpanded}
        className="w-full flex items-center justify-between text-xs font-bold uppercase tracking-tighter cursor-pointer hover:bg-slate-900/50 p-2 rounded-xl transition-colors group border border-transparent hover:border-blue-500/20 text-left"
      >
        <div className="flex items-center gap-2 text-slate-400 group-hover:text-blue-400 transition-colors">
          <Library className="w-4 h-4" />
          <span className="text-sm">{library.name}</span>
          {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
        </div>
        <div className="text-slate-200 bg-blue-500/10 px-2 py-0.5 rounded-full border border-blue-500/20">
          {library.books.length}
        </div>
      </button>
      
      {isExpanded && (
        <motion.div 
          initial={{ opacity: 0, height: 0 }}
          animate={{ opacity: 1, height: "auto" }}
          className="space-y-3 overflow-hidden"
        >
          {library.books.map((book: any, idx: number) => (
            <div key={idx} className="flex items-start gap-3 p-3 bg-slate-950/30 rounded-xl border border-slate-800/50 group/book hover:border-blue-500/30 transition-colors">
              <div className="flex-1">
                <div className="flex items-center justify-between gap-2">
                  <div className="text-sm font-bold leading-tight text-slate-200">
                    {book.title}
                  </div>
                  {book.year && <div className="text-xs font-mono text-slate-400">{book.year}</div>}
                </div>
                <div className="text-xs text-slate-400 uppercase font-bold tracking-tighter">{book.author}</div>
              </div>

              {!book.read && (
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    onMarkAsRead(book.id);
                  }}
                  disabled={markingId !== null}
                  className={`p-2 rounded-lg border transition-all opacity-40 group-hover/book:opacity-100 ${
                    markingId === book.id 
                      ? 'bg-emerald-500/20 border-emerald-500/50 text-emerald-400' 
                      : 'bg-slate-900 border-slate-800 text-slate-500 hover:text-emerald-400 hover:border-emerald-500/30'
                  }`}
                  title="Oznacz jako przeczytane"
                >
                  {markingId === book.id ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <CheckCircle2 className="w-4 h-4" />
                  )}
                </button>
              )}
              {book.read && (
                <div className="p-2 text-emerald-500/50" title="Przeczytane">
                  <CheckCircle2 className="w-4 h-4" />
                </div>
              )}
            </div>
          ))}
        </motion.div>
      )}
    </div>
  );
};
