import React from "react";
import { motion } from "motion/react";
import { User, ChevronDown, ChevronUp, CheckCircle2, Circle } from "lucide-react";

export const AuthorProgressItem: React.FC<{ author: any }> = ({ author }) => {
  const [isExpanded, setIsExpanded] = React.useState(false);
  const percent = author.total > 0 ? Math.round((author.read / author.total) * 100) : 0;
  const color = author.read === author.total ? "emerald" : "cyan";
  const colorClass = color === "emerald" ? "from-emerald-500 to-teal-600" : "from-cyan-500 to-blue-600";
  const shadowClass = color === "emerald" ? "shadow-emerald-500/20" : "shadow-cyan-500/20";

  return (
    <div className="space-y-2">
      <button
        type="button"
        onClick={() => setIsExpanded(!isExpanded)}
        aria-expanded={isExpanded}
        className="w-full flex items-center justify-between text-xs font-bold uppercase tracking-tighter cursor-pointer hover:bg-slate-900/50 p-1 rounded-lg transition-colors group text-left"
      >
        <div className="flex items-center gap-2 text-slate-400 group-hover:text-cyan-400 transition-colors">
          <User className="w-3 h-3" />
          <span>{author.name}</span>
          {isExpanded ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
        </div>
        <div className="text-slate-200">{author.read} / {author.total} ({percent}%)</div>
      </button>
      <div className="h-2 bg-slate-950 rounded-full overflow-hidden border border-slate-800 p-0.5">
        <motion.div 
          initial={{ width: 0 }}
          animate={{ width: `${percent}%` }}
          className={`h-full rounded-full bg-gradient-to-r ${colorClass} shadow-lg ${shadowClass}`}
        />
      </div>
      {isExpanded && (
        <motion.div 
          initial={{ opacity: 0, height: 0 }}
          animate={{ opacity: 1, height: "auto" }}
          className="pl-4 pt-2 space-y-2 overflow-hidden"
        >
          {author.books.map((book: any, idx: number) => (
            <div key={idx} className="flex items-start gap-2 text-xs leading-tight group/book">
              {book.read ? (
                <CheckCircle2 className="w-4 h-4 text-emerald-500 flex-shrink-0 mt-0.5" />
              ) : (
                <Circle className="w-4 h-4 text-slate-600 flex-shrink-0 mt-0.5" />
              )}
              <div className="flex-1">
                <div className="flex items-center justify-between gap-2">
                  <div className={book.read ? "text-slate-200 font-bold" : "text-slate-400 font-bold"}>{book.title}</div>
                  {book.year && <div className="text-[10px] font-mono text-slate-500">{book.year}</div>}
                </div>
              </div>
            </div>
          ))}
        </motion.div>
      )}
    </div>
  );
};
