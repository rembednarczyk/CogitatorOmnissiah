import React from "react";
import { motion } from "motion/react";
import { Building2, Layers, Repeat } from "lucide-react";
import { PublisherStat, SeriesStat, CycleStats } from "../../hooks/useStats";

/**
 * Publishers / Series / Cycles — data from the publisher/series/cycles rituals, not
 * shown until now. Each bar shows PROGRESS by its own label, not size:
 * Publishers = read/titles, Series = owned/total (gaps), Cycles =
 * the share of „części cyklu" in the collection. The list is sorted descending by count anyway.
 */

const barRow = (label: string, value: number, max: number, sub: string, color: string) => (
  <div key={label} className="space-y-1">
    <div className="flex items-baseline justify-between gap-2">
      <span className="text-xs text-slate-300 truncate">{label}</span>
      <span className="text-[10px] text-slate-500 tabular-nums shrink-0">{sub}</span>
    </div>
    <div className="h-1.5 w-full rounded-full bg-slate-950 overflow-hidden">
      <div className={`h-full rounded-full ${color}`} style={{ width: `${max > 0 ? (value / max) * 100 : 0}%` }} />
    </div>
  </div>
);

export const PublishingCard: React.FC<{ publishers: PublisherStat[]; series: SeriesStat[]; cycles: CycleStats }> = ({ publishers, series, cycles }) => {
  const cyclePct = cycles.total > 0 ? Math.round((cycles.partOfCycle / cycles.total) * 100) : 0;

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.18 }}
      className="glass-card p-6 rounded-3xl border-indigo-500/10 space-y-6"
    >
      <h3 className="text-sm font-bold font-display uppercase tracking-widest text-indigo-400 flex items-center gap-2 mb-4">
        <Building2 className="w-4 h-4" />
        Oficyny, Serie i Cykle
      </h3>

      {/* Cycles — share bar */}
      <div className="p-3 rounded-2xl bg-slate-950/40 border border-white/5 space-y-2">
        <div className="flex items-center gap-2 text-xs text-slate-400">
          <Repeat className="w-3.5 h-3.5 text-purple-400" />
          <span className="flex-1">Część cyklu</span>
          <span className="font-bold text-purple-300 tabular-nums">{cycles.partOfCycle}</span>
          <span className="text-slate-500">/ {cycles.total}</span>
          <span className="text-[10px] text-slate-500 tabular-nums w-9 text-right">{cyclePct}%</span>
        </div>
        <div className="h-2 w-full rounded-full bg-slate-950 overflow-hidden border border-slate-800">
          <div className="h-full rounded-full bg-gradient-to-r from-purple-500 to-indigo-600" style={{ width: `${cyclePct}%` }} />
        </div>
      </div>

      {/* Top publishers */}
      <div className="space-y-3">
        <h4 className="text-[11px] font-bold uppercase tracking-widest text-slate-500 flex items-center gap-1.5"><Building2 className="w-3 h-3" /> Top oficyny</h4>
        {publishers.length === 0 ? (
          <p className="text-slate-500 text-xs italic">Brak danych — uruchom „Wydawcy".</p>
        ) : (
          <div className="space-y-2.5 max-h-[200px] overflow-y-auto pr-1 custom-scrollbar">
            {publishers.slice(0, 8).map((p) => barRow(p.name, p.read, p.count, `${p.read}/${p.count} przecz.`, p.read >= p.count ? "bg-emerald-500" : "bg-indigo-500"))}
          </div>
        )}
      </div>

      {/* Series with gaps */}
      <div className="space-y-3">
        <h4 className="text-[11px] font-bold uppercase tracking-widest text-slate-500 flex items-center gap-1.5"><Layers className="w-3 h-3" /> Serie (posiadane/total)</h4>
        {series.length === 0 ? (
          <p className="text-slate-500 text-xs italic">Brak danych — uruchom „Serie".</p>
        ) : (
          <div className="space-y-2.5 max-h-[200px] overflow-y-auto pr-1 custom-scrollbar">
            {series.slice(0, 8).map((s) => barRow(s.name, s.owned, s.count, `${s.owned}/${s.count}${s.owned < s.count ? " · luki" : " · komplet"}`, s.owned >= s.count ? "bg-emerald-500" : "bg-blue-500"))}
          </div>
        )}
      </div>
    </motion.div>
  );
};
