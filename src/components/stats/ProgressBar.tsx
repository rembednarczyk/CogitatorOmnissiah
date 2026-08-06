import React from "react";
import { motion } from "motion/react";

interface ProgressBarProps {
  current: number;
  total: number;
  label: string;
  icon: any;
  color?: string;
}

export const ProgressBar: React.FC<ProgressBarProps> = ({ current, total, label, icon: Icon, color = "cyan" }) => {
  const percent = total > 0 ? Math.round((current / total) * 100) : 0;
  const colorClass = color === "cyan" ? "from-cyan-500 to-blue-600" : 
                     color === "purple" ? "from-purple-500 to-indigo-600" :
                     color === "orange" ? "from-orange-500 to-red-600" : "from-emerald-500 to-teal-600";
  const shadowClass = color === "cyan" ? "shadow-cyan-500/20" : 
                      color === "purple" ? "shadow-purple-500/20" :
                      color === "orange" ? "shadow-orange-500/20" : "shadow-emerald-500/20";

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
