import React from "react";
import { motion } from "motion/react";
import { Library, BookOpenCheck, Package, Compass } from "lucide-react";
import { Stats } from "../../hooks/useStats";

/**
 * „Twoja kolekcja" — nagłówkowy rząd 4 KPI (wg makiety `design/Main.dc.html`).
 * Stały (nie wchodzi w masonry z drag&drop). Responsywny: desktop 4 kolumny,
 * mobile 2×2. Kolory i `font-display` idą przez zmienne palety, więc działa
 * spójnie w obu motywach (jasny „Librem" / ciemny „Warhammer").
 */

interface Kpi {
  key: string;
  label: string;
  value: string;
  sub?: string;
  pct?: number;
  icon: typeof Library;
  accent: string;   // klasa koloru (remap palety)
  bar?: string;     // klasa wypełnienia paska
}

const nf = new Intl.NumberFormat("pl-PL");

export const KpiRow: React.FC<{ stats: Stats }> = ({ stats }) => {
  const total = stats.awardBooksStats.total;
  const read = stats.awardBooksStats.read;
  const owned = stats.decadeStats.reduce((s, d) => s + d.owned, 0);
  const toGet = Math.max(0, total - owned);
  const pctRead = total > 0 ? Math.round((read / total) * 100) : 0;

  const kpis: Kpi[] = [
    { key: "vol", label: "Woluminy", value: nf.format(total), sub: "wydania z listy nagród", icon: Library, accent: "text-slate-100" },
    { key: "read", label: "Przeczytane", value: `${pctRead}%`, pct: pctRead, icon: BookOpenCheck, accent: "text-emerald-400", bar: "bg-emerald-500" },
    { key: "owned", label: "Posiadane", value: nf.format(owned), sub: "na półce / w kolekcji", icon: Package, accent: "text-cyan-400" },
    { key: "toget", label: "Do zdobycia", value: nf.format(toGet), sub: "brakuje w kolekcji", icon: Compass, accent: "text-amber-400" },
  ];

  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-3 md:gap-4">
      {kpis.map((k, i) => (
        <motion.div
          key={k.key}
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: i * 0.05 }}
          className="glass-card rounded-3xl p-4 md:p-5 flex flex-col gap-1.5"
        >
          <div className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-[0.18em] text-slate-500">
            <k.icon className={`w-3.5 h-3.5 ${k.accent}`} />
            <span className="truncate">{k.label}</span>
          </div>
          <div className={`font-display font-bold tabular-nums leading-none text-3xl md:text-4xl ${k.accent}`}>
            {k.value}
          </div>
          {k.pct !== undefined ? (
            <div className="mt-1.5 h-1.5 rounded-full bg-slate-800 overflow-hidden">
              <motion.div
                initial={{ width: 0 }}
                animate={{ width: `${k.pct}%` }}
                transition={{ duration: 0.6, ease: "easeOut" }}
                className={`h-full rounded-full ${k.bar}`}
              />
            </div>
          ) : (
            <div className="text-[11px] md:text-xs text-slate-500">{k.sub}</div>
          )}
        </motion.div>
      ))}
    </div>
  );
};
