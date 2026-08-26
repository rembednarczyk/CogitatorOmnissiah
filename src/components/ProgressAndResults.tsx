import React from "react";
import { motion } from "motion/react";
import { useSync } from "../hooks/useSync";
import { getRitualTheme } from "../theme/ritualColors";

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

  // Ritual theme (see src/theme/ritualColors.ts). bg = full bar fill,
  // shadow = bar glow.
  const t = getRitualTheme(color);
  const theme = { text: t.text, border: t.border, bg: t.bgSolid, shadow: t.glow };

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
