import React from "react";
import { motion } from "motion/react";
import { Compass, Package, Library, ShoppingCart, HelpCircle } from "lucide-react";
import { AvailabilityStats } from "../../hooks/useStats";

/**
 * Aggregated availability of unread books — „where to get it" in one place.
 * A priority partition (owned > library > Vinted > no trace), so the bar
 * sums to `totalUnread`. Combines three scanners (ownership / OPAC / Vinted).
 */

const SEGMENTS: { key: keyof Omit<AvailabilityStats, "totalUnread">; label: string; icon: typeof Package; bar: string; text: string; dot: string }[] = [
  { key: "owned",   label: "Posiadane", icon: Package,      bar: "bg-emerald-500", text: "text-emerald-300", dot: "bg-emerald-500" },
  { key: "library", label: "Biblioteka", icon: Library,     bar: "bg-blue-500",    text: "text-blue-300",    dot: "bg-blue-500" },
  { key: "vinted",  label: "Vinted",     icon: ShoppingCart, bar: "bg-rose-500",    text: "text-rose-300",    dot: "bg-rose-500" },
  { key: "none",    label: "Bez śladu",  icon: HelpCircle,   bar: "bg-slate-600",   text: "text-slate-400",   dot: "bg-slate-600" },
];

export const AvailabilityCard: React.FC<{ stats: AvailabilityStats }> = ({ stats }) => {
  const total = stats.totalUnread;
  const pct = (n: number) => (total > 0 ? (n / total) * 100 : 0);

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.15 }}
      className="glass-card p-6 rounded-3xl border-teal-500/10 space-y-6"
    >
      <h3 className="text-sm font-bold font-display uppercase tracking-widest text-teal-400 flex items-center gap-2 mb-4">
        <Compass className="w-4 h-4" />
        Dostępność Nieprzeczytanych
      </h3>

      {total === 0 ? (
        <p className="text-slate-400 text-sm italic text-center py-8">Wszystko przeczytane — Archiwum domknięte.</p>
      ) : (
        <>
          <div className="flex items-baseline gap-2">
            <span className="text-3xl font-bold font-display text-slate-100 tabular-nums">{total}</span>
            <span className="text-xs text-slate-500 uppercase tracking-widest font-bold">woluminów do zdobycia</span>
          </div>

          {/* Aggregate bar (partition) */}
          <div className="h-3 w-full rounded-full overflow-hidden flex bg-slate-950 border border-slate-800">
            {SEGMENTS.map((s) => {
              const w = pct(stats[s.key]);
              return w > 0 ? <div key={s.key} className={`h-full ${s.bar}`} style={{ width: `${w}%` }} title={`${s.label}: ${stats[s.key]}`} /> : null;
            })}
          </div>

          {/* Legend + numbers */}
          <div className="grid grid-cols-2 gap-3">
            {SEGMENTS.map((s) => {
              const Icon = s.icon;
              return (
                <div key={s.key} className="flex items-center gap-2.5 p-2.5 rounded-xl bg-slate-950/40 border border-white/5">
                  <span className={`w-2 h-2 rounded-full ${s.dot} shrink-0`} />
                  <Icon className={`w-4 h-4 ${s.text} shrink-0`} />
                  <span className="text-xs text-slate-400 flex-1 truncate">{s.label}</span>
                  <span className={`text-sm font-bold tabular-nums ${s.text}`}>{stats[s.key]}</span>
                  <span className="text-[10px] text-slate-500 tabular-nums w-9 text-right">{Math.round(pct(stats[s.key]))}%</span>
                </div>
              );
            })}
          </div>
        </>
      )}
    </motion.div>
  );
};
