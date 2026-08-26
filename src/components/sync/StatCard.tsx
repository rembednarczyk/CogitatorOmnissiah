import React from "react";

interface Props {
  label: string;
  count: number;
  color: string;   // number color class, e.g. "text-emerald-400"
  bg: string;      // card background class, e.g. "bg-emerald-500/10"
  countClass?: string;  // number size (full-sync: text-2xl, single: text-3xl)
  labelClass?: string;  // label size (full-sync: text-[10px], single: text-xs)
}

/** Numeric summary tile (Added / Updated / …). */
export const StatCard: React.FC<Props> = ({ label, count, color, bg, countClass = "text-2xl", labelClass = "text-[10px]" }) => (
  <div className={`p-4 rounded-2xl ${bg} border border-white/5`}>
    <div className={`${labelClass} font-bold text-slate-500 uppercase tracking-widest mb-1`}>{label}</div>
    <div className={`${countClass} font-bold font-display ${color}`}>{count}</div>
  </div>
);
