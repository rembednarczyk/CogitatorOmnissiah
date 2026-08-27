import React from "react";
import { motion } from "motion/react";
import { BarChart3, Crown } from "lucide-react";
import { DecadeStat } from "../../hooks/useStats";

/**
 * Timeline / decades — a histogram of the collection's distribution by publication decade (the app
 * already thinks in decades via the shelf). Bar = total; fill = read.
 * Highlights the „golden era" (the most populous decade).
 */
export const DecadeHistogram: React.FC<{ decades: DecadeStat[] }> = ({ decades }) => {
  const max = Math.max(1, ...decades.map((d) => d.total));
  const peak = decades.reduce<DecadeStat | null>((best, d) => (!best || d.total > best.total ? d : best), null);
  const totalRead = decades.reduce((s, d) => s + d.read, 0);
  const totalAll = decades.reduce((s, d) => s + d.total, 0);

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.22 }}
      className="glass-card p-6 rounded-3xl border-amber-500/10 space-y-6"
    >
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-bold font-display uppercase tracking-widest text-amber-400 flex items-center gap-2">
          <BarChart3 className="w-4 h-4" />
          Oś czasu
        </h3>
        {peak && (
          <span className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-widest text-amber-300/80">
            <Crown className="w-3.5 h-3.5" /> Złota era: {peak.decade}.
          </span>
        )}
      </div>

      {decades.length === 0 ? (
        <p className="text-slate-400 text-sm italic text-center py-8">Brak dat wydania w kolekcji.</p>
      ) : (
        <>
          {/* Histogram — vertical bars, fill = read */}
          <div className="flex items-end gap-1.5 h-[160px] pt-2">
            {decades.map((d) => {
              const h = (d.total / max) * 100;
              const readH = d.total > 0 ? (d.read / d.total) * 100 : 0;
              const isPeak = peak?.decade === d.decade;
              return (
                <div key={d.decade} className="flex-1 h-full flex flex-col items-center gap-1.5 min-w-0 group">
                  <span className="text-[9px] text-slate-500 tabular-nums opacity-0 group-hover:opacity-100 transition-opacity">{d.total}</span>
                  <div className="w-full flex-1 flex items-end" style={{ minHeight: 1 }}>
                    <div
                      className={`w-full rounded-t-[3px] relative overflow-hidden ${isPeak ? "bg-amber-500/25" : "bg-slate-700/40"}`}
                      style={{ height: `${Math.max(h, 2)}%` }}
                      title={`${d.decade}–${d.decade + 9}: ${d.total} (przecz. ${d.read}, posiad. ${d.owned})`}
                    >
                      {/* Fill = read (from the bottom) */}
                      <div
                        className={`absolute bottom-0 inset-x-0 ${isPeak ? "bg-gradient-to-t from-amber-500 to-amber-400" : "bg-gradient-to-t from-cyan-500 to-cyan-400"}`}
                        style={{ height: `${readH}%` }}
                      />
                    </div>
                  </div>
                  <span className="text-[9px] text-slate-500 tabular-nums whitespace-nowrap">{`'${String(d.decade % 100).padStart(2, "0")}`}</span>
                </div>
              );
            })}
          </div>

          {/* Legend */}
          <div className="flex items-center justify-center gap-5 text-[10px] text-slate-500 uppercase tracking-widest font-bold">
            <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-sm bg-cyan-400" /> Przeczytane</span>
            <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-sm bg-slate-700/60" /> Pozostałe</span>
            <span className="text-slate-400 tabular-nums normal-case tracking-normal">{totalRead}/{totalAll} łącznie</span>
          </div>
        </>
      )}
    </motion.div>
  );
};
