import React from "react";
import { CheckCircle2, Loader2 } from "lucide-react";

interface Props {
  book: { id: string; title: string; author: string; year?: number | null };
  marking: boolean;      // whether this specific item is being marked
  disabled: boolean;     // whether any marking is in progress (lock)
  onMarkAsRead: (pageId: string) => void;
}

/** A row for an owned but unread item, with a „mark as read" action. */
export const OwnedUnreadItem: React.FC<Props> = ({ book, marking, disabled, onMarkAsRead }) => (
  <div className="flex items-start gap-3 p-3 bg-slate-950/30 rounded-xl border border-slate-800/50 group/book">
    <div className="flex-1">
      <div className="flex items-center justify-between gap-2">
        <div className="text-sm font-bold text-slate-200 leading-tight">{book.title}</div>
        {book.year && <div className="text-xs font-mono text-slate-400">{book.year}</div>}
      </div>
      <div className="text-xs text-slate-400 uppercase font-bold tracking-tighter">{book.author}</div>
    </div>

    <button
      onClick={() => onMarkAsRead(book.id)}
      disabled={disabled}
      className={`p-2 rounded-lg border transition-all opacity-40 group-hover/book:opacity-100 ${
        marking
          ? 'bg-emerald-500/20 border-emerald-500/50 text-emerald-400'
          : 'bg-slate-900 border-slate-800 text-slate-500 hover:text-emerald-400 hover:border-emerald-500/30'
      }`}
      title="Oznacz jako przeczytane"
    >
      {marking ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />}
    </button>
  </div>
);
