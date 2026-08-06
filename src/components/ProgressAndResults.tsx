import React from "react";
import { motion } from "motion/react";
import { useSync } from "../hooks/useSync";

interface ProgressAndResultsProps {
  syncs: ReturnType<typeof useSync>[];
  formatETA: (current: number, total: number, startTime: number | null) => string | null;
}

export const ProgressAndResults: React.FC<ProgressAndResultsProps> = ({
  syncs,
  formatETA
}) => {
  const activeSync = syncs.find(s => s.state.loading);

  if (!activeSync) return null;

  const state = activeSync.state;
  const color = state.color || "cyan";
  const progress = state.progress || { current: 0, total: 1 };
  const percent = progress.total > 0 ? Math.round((progress.current / progress.total) * 100) : 0;

  // Map color names to Tailwind classes
  const colorMap: Record<string, { text: string, border: string, bg: string, shadow: string }> = {
    cyan: { text: "text-cyan-400", border: "border-cyan-500/20", bg: "bg-cyan-500", shadow: "shadow-[0_0_15px_rgba(34,211,238,0.4)]" },
    rose: { text: "text-rose-400", border: "border-rose-500/20", bg: "bg-rose-500", shadow: "shadow-[0_0_15px_rgba(244,63,94,0.4)]" },
    indigo: { text: "text-indigo-400", border: "border-indigo-500/20", bg: "bg-indigo-500", shadow: "shadow-[0_0_15px_rgba(99,102,241,0.4)]" },
    blue: { text: "text-blue-400", border: "border-blue-500/20", bg: "bg-blue-500", shadow: "shadow-[0_0_15px_rgba(59,130,246,0.4)]" },
    purple: { text: "text-purple-400", border: "border-purple-500/20", bg: "bg-purple-500", shadow: "shadow-[0_0_15px_rgba(168,85,247,0.4)]" },
    orange: { text: "text-orange-400", border: "border-orange-500/20", bg: "bg-orange-500", shadow: "shadow-[0_0_15px_rgba(249,115,22,0.4)]" },
    amber: { text: "text-amber-400", border: "border-amber-500/20", bg: "bg-amber-500", shadow: "shadow-[0_0_15px_rgba(245,158,11,0.4)]" },
    emerald: { text: "text-emerald-400", border: "border-emerald-500/20", bg: "bg-emerald-500", shadow: "shadow-[0_0_15px_rgba(16,185,129,0.4)]" },
  };

  const theme = colorMap[color] || colorMap.cyan;

  return (
    <motion.div 
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -20 }}
      className={`glass-card p-8 rounded-3xl ${theme.border}`}
    >
      <div className="flex items-center justify-between mb-6">
        <div className="flex flex-col">
          <h3 className={`text-lg font-bold font-display ${theme.text} uppercase tracking-widest mb-1`}>
            {state.statusMessage || "Rytuał w toku..."}
          </h3>
          <div className="text-xs text-slate-500 font-bold uppercase tracking-tighter">
            {formatETA(progress.current, progress.total, state.startTime)}
          </div>
        </div>
        <div className="text-2xl font-bold font-display text-slate-200">
          {percent}%
        </div>
      </div>
      
      <div className="w-full bg-slate-950 rounded-full h-4 overflow-hidden border border-slate-800 p-1">
        <motion.div 
          className={`${theme.bg} h-full rounded-full ${theme.shadow}`}
          initial={{ width: 0 }}
          animate={{ width: `${Math.max(2, percent)}%` }}
          transition={{ type: "spring", bounce: 0, duration: 0.5 }}
        />
      </div>

      <div className="mt-6 flex justify-end">
        <button 
          onClick={activeSync.stopSync}
          className="px-6 py-2 bg-red-950/40 hover:bg-red-900/60 text-red-400 rounded-xl text-xs font-bold uppercase tracking-widest border border-red-900/30 transition-all"
        >
          Anihilacja Procesu
        </button>
      </div>
    </motion.div>
  );
};
