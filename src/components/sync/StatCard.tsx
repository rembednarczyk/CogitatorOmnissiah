import React from "react";

interface Props {
  label: string;
  count: number;
  color: string;   // klasa koloru liczby, np. "text-emerald-400"
  bg: string;      // klasa tła karty, np. "bg-emerald-500/10"
  countClass?: string;  // rozmiar liczby (full-sync: text-2xl, single: text-3xl)
  labelClass?: string;  // rozmiar etykiety (full-sync: text-[10px], single: text-xs)
}

/** Kafelek liczbowy podsumowania (Dodano / Zaktualizowano / …). */
export const StatCard: React.FC<Props> = ({ label, count, color, bg, countClass = "text-2xl", labelClass = "text-[10px]" }) => (
  <div className={`p-4 rounded-2xl ${bg} border border-white/5`}>
    <div className={`${labelClass} font-bold text-slate-500 uppercase tracking-widest mb-1`}>{label}</div>
    <div className={`${countClass} font-bold font-display ${color}`}>{count}</div>
  </div>
);
