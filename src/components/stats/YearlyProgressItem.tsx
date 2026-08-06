import React from "react";
import { motion } from "motion/react";
import { Calendar, ChevronDown, ChevronUp, CheckCircle2, Circle } from "lucide-react";

export const YearlyProgressItem: React.FC<{ year: any }> = ({ year }) => {
  const [isExpanded, setIsExpanded] = React.useState(false);
  const percent = year.total > 0 ? Math.round((year.read / year.total) * 100) : 0;

  return (
    <div className="space-y-2">
      <button
        type="button"
        onClick={() => setIsExpanded(!isExpanded)}
        aria-expanded={isExpanded}
        className="w-full flex items-center justify-between text-xs font-bold uppercase tracking-tighter cursor-pointer hover:bg-slate-900/50 p-1 rounded-lg transition-colors group text-left"
      >
        <div className="flex items-center gap-2 text-slate-400 group-hover:text-orange-400 transition-colors">
          <Calendar className="w-3 h-3" />
          <span>{year.year}</span>
          {isExpanded ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
        </div>
        <div className="text-slate-200">{year.read} / {year.total} ({percent}%)</div>
      </button>
      <div className="h-2 bg-slate-950 rounded-full overflow-hidden border border-slate-800 p-0.5">
        <motion.div 
          initial={{ width: 0 }}
          animate={{ width: `${percent}%` }}
          className="h-full rounded-full bg-gradient-to-r from-orange-500 to-red-600 shadow-lg shadow-orange-500/20"
        />
      </div>
      {isExpanded && (
        <motion.div 
          initial={{ opacity: 0, height: 0 }}
          animate={{ opacity: 1, height: "auto" }}
          className="pl-4 pt-2 space-y-2 overflow-hidden"
        >
          {year.books.map((book: any, idx: number) => (
            <div key={idx} className="flex items-start gap-2 text-xs leading-tight group/book">
              {book.read ? (
                <CheckCircle2 className="w-4 h-4 text-emerald-500 flex-shrink-0 mt-0.5" />
              ) : (
                <Circle className="w-4 h-4 text-slate-600 flex-shrink-0 mt-0.5" />
              )}
              <div className={book.read ? "text-slate-200" : "text-slate-400"}>
                <span className="font-bold">{book.title}</span>
                <span className="mx-1 text-slate-500">—</span>
                <span className="italic">{book.author}</span>
              </div>
            </div>
          ))}
        </motion.div>
      )}
    </div>
  );
};
