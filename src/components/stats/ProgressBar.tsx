import React from "react";
import { motion } from "motion/react";
import { getRitualGradient } from "../../theme/ritualColors";

interface ProgressBarProps {
  current: number;
  total: number;
  label: string;
  icon: any;
  color?: string;
}

export const ProgressBar: React.FC<ProgressBarProps> = ({ current, total, label, icon: Icon, color = "cyan" }) => {
  const percent = total > 0 ? Math.round((current / total) * 100) : 0;
  const { gradient: colorClass, shadow: shadowClass } = getRitualGradient(color);

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between text-xs font-bold uppercase tracking-tighter">
        <div className="flex items-center gap-2 text-slate-400">
          <Icon className="w-3 h-3" />
          <span>{label}</span>
        </div>
        <div className="text-slate-200">{current} / {total} ({percent}%)</div>
      </div>
      <div className="h-2 bg-slate-950 rounded-full overflow-hidden border border-slate-800 p-0.5">
        <motion.div 
          initial={{ width: 0 }}
          animate={{ width: `${percent}%` }}
          className={`h-full rounded-full bg-gradient-to-r ${colorClass} shadow-lg ${shadowClass}`}
        />
      </div>
    </div>
  );
};
