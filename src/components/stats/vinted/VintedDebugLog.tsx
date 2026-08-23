import React from "react";
import { motion, AnimatePresence } from "motion/react";
import { ExternalLink, Loader2, Bug, CheckCircle2, XCircle, AlertCircle } from "lucide-react";
import { VintedSearchAttempt } from "../../../hooks/useVintedCheck";
import { formatDebug } from "../../../utils/vintedFormat";

/** Zwijany panel logów skanowania (diagnostyka per próba). */
export const VintedDebugLog: React.FC<{ searchAttempts: VintedSearchAttempt[]; show: boolean }> = ({ searchAttempts, show }) => (
  <AnimatePresence>
    {show && searchAttempts.length > 0 && (
      <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} exit={{ opacity: 0, height: 0 }} className="overflow-hidden">
        <div className="p-6 rounded-3xl bg-slate-950/50 border border-amber-500/10 space-y-4">
          <div className="flex items-center justify-between mb-2">
            <h4 className="text-xs font-bold text-amber-500 uppercase tracking-widest flex items-center gap-2">
              <Bug className="w-3 h-3" /> Logi Skanowania (Debug)
            </h4>
            <span className="text-[10px] text-slate-500 uppercase font-bold">{searchAttempts.length} prób</span>
          </div>
          <div className="space-y-2 max-h-[400px] overflow-y-auto pr-2 custom-scrollbar">
            {searchAttempts.map((attempt, i) => (
              <div key={i} className="flex items-center justify-between gap-4 p-3 rounded-2xl bg-slate-900/50 border border-slate-800/50 text-[11px] group/log hover:border-amber-500/20 transition-colors">
                <div className="flex items-center gap-3 min-w-0">
                  <div className="shrink-0">
                    {attempt.status === "success" && <CheckCircle2 className="w-4 h-4 text-emerald-500" />}
                    {attempt.status === "no_results" && <XCircle className="w-4 h-4 text-slate-600" />}
                    {attempt.status === "blocked" && <AlertCircle className="w-4 h-4 text-amber-500" />}
                    {attempt.status === "error" && <AlertCircle className="w-4 h-4 text-red-500" />}
                    {attempt.status === "pending" && <Loader2 className="w-4 h-4 text-cyan-500 animate-spin" />}
                  </div>
                  <div className="flex flex-col min-w-0">
                    <span className="text-slate-200 font-bold truncate group-hover/log:text-slate-100 transition-colors">{attempt.title}</span>
                    <span className="text-slate-500 text-[9px] uppercase tracking-widest font-bold">{attempt.author}</span>
                    {attempt.debug && <span className="text-[9px] font-mono text-slate-500 truncate mt-0.5">{formatDebug(attempt.debug)}</span>}
                  </div>
                </div>
                <div className="flex items-center gap-3 shrink-0">
                  {attempt.itemCount > 0 && (
                    <span className="px-2 py-0.5 rounded-lg bg-emerald-500/10 text-emerald-500 font-bold border border-emerald-500/20">{attempt.itemCount}</span>
                  )}
                  <a href={attempt.url} target="_blank" rel="noopener noreferrer" className="p-2 rounded-xl bg-slate-800/50 hover:bg-amber-500/10 text-slate-500 hover:text-amber-400 transition-all" title="Zobacz zapytanie">
                    <ExternalLink className="w-3.5 h-3.5" />
                  </a>
                </div>
              </div>
            ))}
          </div>
        </div>
      </motion.div>
    )}
  </AnimatePresence>
);
