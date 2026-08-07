import React from "react";
import { motion } from "motion/react";
import { Search, ChevronDown, ChevronUp, Loader2, Library, CheckCircle2 } from "lucide-react";
import { formatETA } from "../../utils/time";
import { IdentifiedBook } from "../../hooks/useStats";

interface IdentifiedLibraryItemProps {
  library: { id: string; name: string; code: string; sourceTag: string };
  books: IdentifiedBook[];
  onCheck: () => void;
  onStop: () => void;
  onMarkAsRead: (pageId: string, tag?: string) => void;
  markingId: string | null;
  // Klucze „{tag}:{pageId}" pozycji już oznaczonych znacznikiem filii.
  markedIds: Set<string>;
  isChecking: boolean;
  progress: any;
}

export const IdentifiedLibraryItem: React.FC<IdentifiedLibraryItemProps> = ({ 
  library, 
  books, 
  onCheck, 
  onStop, 
  onMarkAsRead,
  markingId,
  markedIds,
  isChecking,
  progress
}) => {
  const [isExpanded, setIsExpanded] = React.useState(true);

  const sortedBooks = React.useMemo(() => {
    return [...books].sort((a, b) => {
      const aExact = a.extractedTitle && a.extractedTitle.toLowerCase() === a.title.toLowerCase();
      const bExact = b.extractedTitle && b.extractedTitle.toLowerCase() === b.title.toLowerCase();
      
      if (aExact && !bExact) return -1;
      if (!aExact && bExact) return 1;
      return 0;
    });
  }, [books]);

  return (
    <div className="space-y-4">
      <div 
        className="flex items-center justify-between text-xs font-bold uppercase tracking-tighter p-2 rounded-xl border border-slate-800/50 bg-slate-900/20"
      >
        <button
          type="button"
          onClick={() => setIsExpanded(!isExpanded)}
          aria-expanded={isExpanded}
          className="flex items-center gap-2 text-slate-400 cursor-pointer hover:text-blue-400 transition-colors flex-1 text-left"
        >
          <Search className="w-4 h-4" />
          <span className="text-sm">{library.name}</span>
          {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
        </button>
        
        <div className="flex items-center gap-3">
          {books.length > 0 && (
            <div className="text-slate-200 bg-blue-500/10 px-2 py-0.5 rounded-full border border-blue-500/20">
              {books.length}
            </div>
          )}
          <button
            onClick={(e) => { 
              e.stopPropagation(); 
              if (isChecking) onStop();
              else onCheck(); 
            }}
            className={`flex items-center gap-1 px-3 py-1 rounded-lg transition-all text-xs font-bold text-white ${
              isChecking 
                ? "bg-red-600 hover:bg-red-500" 
                : "bg-blue-600 hover:bg-blue-500"
            }`}
          >
            {isChecking ? (
              <>
                <Loader2 className="w-3 h-3 animate-spin" />
                <span>Zatrzymaj</span>
              </>
            ) : (
              <>
                <Search className="w-3 h-3" />
                <span>Skanuj dostępność</span>
              </>
            )}
          </button>
        </div>
      </div>

      {isChecking && progress && (
        <div className="px-2 space-y-1">
          <div className="flex justify-between text-xs text-slate-400 uppercase font-bold">
            <div className="flex flex-col gap-0.5 flex-1 min-w-0">
              <span className="break-words">{progress.message}</span>
              {progress.startTime && (
                <span className="text-[10px] text-slate-500 lowercase font-medium">
                  {formatETA(progress.current, progress.total, progress.startTime)}
                </span>
              )}
            </div>
            {progress.total > 0 && <span>{progress.current} / {progress.total}</span>}
          </div>
          {progress.total > 0 && (
            <div className="h-1 bg-slate-900 rounded-full overflow-hidden">
              <motion.div 
                initial={{ width: 0 }}
                animate={{ width: `${(progress.current / progress.total) * 100}%` }}
                className="h-full bg-blue-500"
              />
            </div>
          )}
        </div>
      )}
      
      {isExpanded && books.length > 0 && (
        <motion.div 
          initial={{ opacity: 0, height: 0 }}
          animate={{ opacity: 1, height: "auto" }}
          className="space-y-3 overflow-hidden"
        >
          {sortedBooks.map((book: any, idx: number) => {
            const isExactMatch = book.extractedTitle && book.extractedTitle.toLowerCase() === book.title.toLowerCase();
            const isMarked = markedIds.has(`${library.sourceTag}:${book.id}`);
            return (
            <div key={idx} className={`flex items-start gap-3 p-3 rounded-xl border transition-colors group/book ${
              isExactMatch 
                ? "bg-green-500/5 border-green-500/30 hover:border-green-500/50" 
                : "bg-slate-950/30 border-slate-800/50 hover:border-blue-500/30"
            }`}>
              <div className="flex-1">
                <div className="flex items-center justify-between gap-2">
                  <div className={`text-sm font-bold leading-tight ${isExactMatch ? "text-green-400" : "text-slate-200"}`}>
                    {book.title}
                  </div>
                  {book.year && <div className="text-xs font-mono text-slate-400">{book.year}</div>}
                </div>
                <div className="text-xs text-slate-400 uppercase font-bold tracking-tighter">{book.author}</div>
                {(book.extractedTitle && !isExactMatch) || (book.extractedAuthor && book.extractedAuthor !== book.author) ? (
                  <div className="mt-2 text-xs text-orange-400/80 bg-orange-500/10 p-1.5 rounded border border-orange-500/20">
                    <span className="font-bold">Znaleziono jako:</span> {book.extractedTitle || book.title}
                    {book.extractedAuthor && ` - ${book.extractedAuthor}`}
                  </div>
                ) : null}
              </div>

              <button
                onClick={() => onMarkAsRead(book.id, library.sourceTag)}
                disabled={markingId !== null || isMarked}
                className={`p-2 rounded-lg border transition-all ${
                  isMarked
                    ? 'opacity-100 bg-emerald-500/10 border-emerald-500/40 text-emerald-500/80 cursor-not-allowed'
                    : `opacity-40 group-hover/book:opacity-100 ${
                        markingId === book.id
                          ? 'bg-blue-500/20 border-blue-500/50 text-blue-400'
                          : 'bg-slate-900 border-slate-800 text-slate-500 hover:text-blue-400 hover:border-blue-500/30'
                      }`
                }`}
                title={isMarked
                  ? `Oznaczono w tej filii (tag „${library.sourceTag}")`
                  : `Oznacz jako dostępne w filii (tag „${library.sourceTag}")`}
              >
                {markingId === book.id ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : isMarked ? (
                  <CheckCircle2 className="w-4 h-4" />
                ) : (
                  <Library className="w-4 h-4" />
                )}
              </button>
            </div>
          )})}
        </motion.div>
      )}
      
      {isExpanded && books.length === 0 && !isChecking && (
        <p className="text-xs text-slate-500 italic text-center py-4">Brak zidentyfikowanych pozycji. Uruchom skanowanie.</p>
      )}
    </div>
  );
};
