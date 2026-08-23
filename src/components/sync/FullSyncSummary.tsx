import React from "react";
import { motion } from "motion/react";
import { XCircle, AlertCircle, Copy, Check } from "lucide-react";
import { getRitualDot } from "../../theme/ritualColors";
import { useCopyToClipboard } from "../../hooks/useCopyToClipboard";
import { StatCard } from "./StatCard";

/** Podsumowanie „Wielkiego Rytuału" — agregat wszystkich kroków pełnej synchronizacji. */
export const FullSyncSummary: React.FC<{ results: any[]; onClose: () => void }> = ({ results, onClose }) => {
  const { copied, copy } = useCopyToClipboard();

  const totalAdded = results.reduce((acc, curr) => acc + (curr.result?.summary?.added?.length || 0), 0);
  const totalUpdated = results.reduce((acc, curr) => acc + (curr.result?.updated || 0), 0);
  const totalSkipped = results.reduce((acc, curr) => acc + (curr.result?.summary?.skipped?.length || 0), 0);
  const allDuplicates: string[] = results.flatMap(curr => curr.result?.summary?.duplicates || []);

  return (
    <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="glass-card p-8 rounded-3xl border-cyan-500/30 bg-cyan-500/5">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h3 className="text-xl font-bold font-display text-cyan-400 uppercase tracking-widest">Podsumowanie Wielkiego Rytuału</h3>
          <p className="text-[10px] text-slate-500 uppercase font-bold tracking-widest mt-1">Pełna Synchronizacja Archiwów Zakończona</p>
        </div>
        <button onClick={onClose} className="text-slate-500 hover:text-slate-200 transition-colors" title="Zamknij podsumowanie">
          <XCircle className="w-6 h-6" />
        </button>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-10">
        <StatCard label="Suma Dodanych" count={totalAdded} color="text-emerald-400" bg="bg-emerald-500/10" />
        <StatCard label="Suma Zaktualizowanych" count={totalUpdated} color="text-cyan-400" bg="bg-cyan-500/10" />
        <StatCard label="Suma Pominiętych" count={totalSkipped} color="text-slate-400" bg="bg-slate-500/10" />
        <StatCard label="Wszystkie Duplikaty" count={allDuplicates.length} color="text-amber-400" bg="bg-amber-500/10" />
      </div>

      <div className="space-y-4">
        <h4 className="text-xs font-bold text-slate-400 uppercase tracking-[0.3em] mb-4">Szczegóły Poszczególnych Kroków</h4>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
          {results.map((res) => (
            <div key={res.name} className="p-3 rounded-xl bg-slate-900/40 border border-slate-800/50 flex items-center justify-between">
              <div className="flex items-center gap-3">
                {/* Tailwind nie generuje klas budowanych dynamicznie — mapuj statycznie */}
                <div className={`w-2 h-2 rounded-full ${getRitualDot(res.color)}`} />
                <span className="text-xs font-bold text-slate-300 uppercase tracking-wider">{res.name}</span>
              </div>
              <div className="text-[10px] font-mono text-slate-500">
                +{res.result?.summary?.added?.length || 0} / ~{res.result?.updated || 0}
              </div>
            </div>
          ))}
        </div>
      </div>

      {allDuplicates.length > 0 && (
        <div className="mt-10 bg-slate-900/50 border border-slate-800 rounded-3xl p-6">
          <div className="flex items-center justify-between mb-4">
            <h4 className="text-sm font-bold text-amber-400 uppercase tracking-widest flex items-center gap-2">
              <AlertCircle className="w-4 h-4" /> Zbiorcza Lista Duplikatów ({allDuplicates.length})
            </h4>
            <button onClick={() => copy(allDuplicates.join("\n"))} className="p-2 hover:bg-amber-500/10 rounded-lg text-amber-400/60 hover:text-amber-400 transition-all">
              {copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
            </button>
          </div>
          <div className="max-h-48 overflow-y-auto pr-2 custom-scrollbar space-y-1">
            {allDuplicates.map((item, i) => (
              <div key={i} className="text-[10px] text-slate-400 font-medium border-l border-amber-500/30 pl-2 py-0.5">{item}</div>
            ))}
          </div>
        </div>
      )}
    </motion.div>
  );
};
