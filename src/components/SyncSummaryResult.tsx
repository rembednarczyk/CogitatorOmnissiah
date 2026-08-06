import React, { useState } from "react";
import { XCircle, CheckCircle2, RefreshCw, AlertCircle, Copy, Check } from "lucide-react";
import { motion } from "motion/react";
import { useSync } from "../hooks/useSync";

const stepDotColorMap: Record<string, string> = {
  emerald: "bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.5)]",
  amber: "bg-amber-500 shadow-[0_0_8px_rgba(245,158,11,0.5)]",
  cyan: "bg-cyan-500 shadow-[0_0_8px_rgba(6,182,212,0.5)]",
  blue: "bg-blue-500 shadow-[0_0_8px_rgba(59,130,246,0.5)]",
  rose: "bg-rose-500 shadow-[0_0_8px_rgba(244,63,94,0.5)]",
  indigo: "bg-indigo-500 shadow-[0_0_8px_rgba(99,102,241,0.5)]",
  purple: "bg-purple-500 shadow-[0_0_8px_rgba(168,85,247,0.5)]",
};

interface SyncSummaryResultProps {
  syncs: ReturnType<typeof useSync>[];
  fullSyncResults?: any[] | null;
  onClearFullResults?: () => void;
}

export const SyncSummaryResult: React.FC<SyncSummaryResultProps> = ({
  syncs,
  fullSyncResults,
  onClearFullResults
}) => {
  const [copied, setCopied] = useState(false);
  
  const activeSync = syncs.find(s => s.state.result && s.endpoint !== "/api/sync-integrity");
  
  if (!activeSync && !fullSyncResults) return null;

  // If we have full sync results, we show the aggregated view
  if (fullSyncResults && fullSyncResults.length > 0) {
    const totalAdded = fullSyncResults.reduce((acc, curr) => acc + (curr.result?.summary?.added?.length || 0), 0);
    const totalUpdated = fullSyncResults.reduce((acc, curr) => acc + (curr.result?.updated || 0), 0);
    const totalSkipped = fullSyncResults.reduce((acc, curr) => acc + (curr.result?.summary?.skipped?.length || 0), 0);
    const allDuplicates = fullSyncResults.flatMap(curr => curr.result?.summary?.duplicates || []);

    const handleCloseFull = () => {
      syncs.forEach(s => s.setState(prev => ({ ...prev, result: null })));
      onClearFullResults?.();
    };

    return (
      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="glass-card p-8 rounded-3xl border-cyan-500/30 bg-cyan-500/5"
      >
        <div className="flex items-center justify-between mb-8">
          <div>
            <h3 className="text-xl font-bold font-display text-cyan-400 uppercase tracking-widest">Podsumowanie Wielkiego Rytuału</h3>
            <p className="text-[10px] text-slate-500 uppercase font-bold tracking-widest mt-1">Pełna Synchronizacja Archiwów Zakończona</p>
          </div>
          <button
            onClick={handleCloseFull}
            className="text-slate-500 hover:text-slate-200 transition-colors"
            title="Zamknij podsumowanie"
          >
            <XCircle className="w-6 h-6" />
          </button>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-10">
          {[
            { label: "Suma Dodanych", count: totalAdded, color: "text-emerald-400", bg: "bg-emerald-500/10" },
            { label: "Suma Zaktualizowanych", count: totalUpdated, color: "text-cyan-400", bg: "bg-cyan-500/10" },
            { label: "Suma Pominiętych", count: totalSkipped, color: "text-slate-400", bg: "bg-slate-500/10" },
            { label: "Wszystkie Duplikaty", count: allDuplicates.length, color: "text-amber-400", bg: "bg-amber-500/10" }
          ].map((stat, i) => (
            <div key={i} className={`p-4 rounded-2xl ${stat.bg} border border-white/5`}>
              <div className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-1">{stat.label}</div>
              <div className={`text-2xl font-bold font-display ${stat.color}`}>{stat.count}</div>
            </div>
          ))}
        </div>

        <div className="space-y-4">
          <h4 className="text-xs font-bold text-slate-400 uppercase tracking-[0.3em] mb-4">Szczegóły Poszczególnych Kroków</h4>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            {fullSyncResults.map((res) => (
              <div key={res.name} className="p-3 rounded-xl bg-slate-900/40 border border-slate-800/50 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  {/* Tailwind nie generuje klas budowanych dynamicznie — mapuj statycznie */}
                  <div className={`w-2 h-2 rounded-full ${stepDotColorMap[res.color] || stepDotColorMap.cyan}`} />
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
              <button 
                onClick={() => {
                  navigator.clipboard.writeText(allDuplicates.join("\n")).then(() => {
                    setCopied(true);
                    setTimeout(() => setCopied(false), 2000);
                  });
                }}
                className="p-2 hover:bg-amber-500/10 rounded-lg text-amber-400/60 hover:text-amber-400 transition-all"
              >
                {copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
              </button>
            </div>
            <div className="max-h-48 overflow-y-auto pr-2 custom-scrollbar space-y-1">
              {allDuplicates.map((item: string, i: number) => (
                <div key={i} className="text-[10px] text-slate-400 font-medium border-l border-amber-500/30 pl-2 py-0.5">
                  {item}
                </div>
              ))}
            </div>
          </div>
        )}
      </motion.div>
    );
  }

  if (!activeSync) return null;

  const activeResult = activeSync.state.result;
  const color = activeSync.state.color || "cyan";
  const summary = activeResult?.summary;

  // Map color names to Tailwind classes
  const colorMap: Record<string, { text: string, border: string, bg: string }> = {
    cyan: { text: "text-cyan-400", border: "border-cyan-500/20", bg: "bg-cyan-500/10" },
    rose: { text: "text-rose-400", border: "border-rose-500/20", bg: "bg-rose-500/10" },
    indigo: { text: "text-indigo-400", border: "border-indigo-500/20", bg: "bg-indigo-500/10" },
    blue: { text: "text-blue-400", border: "border-blue-500/20", bg: "bg-blue-500/10" },
    purple: { text: "text-purple-400", border: "border-purple-500/20", bg: "bg-purple-500/10" },
    orange: { text: "text-orange-400", border: "border-orange-500/20", bg: "bg-orange-500/10" },
    amber: { text: "text-amber-400", border: "border-amber-500/20", bg: "bg-amber-500/10" },
    emerald: { text: "text-emerald-400", border: "border-emerald-500/20", bg: "bg-emerald-500/10" },
  };

  const theme = colorMap[color] || colorMap.cyan;

  const handleClose = () => {
    syncs.forEach(s => s.setState(prev => ({ ...prev, result: null })));
  };

  const handleCopyDuplicates = () => {
    if (!summary?.duplicates) return;
    const text = summary.duplicates.join("\n");
    navigator.clipboard.writeText(text).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };

  return (
    <motion.div 
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className={`glass-card p-8 rounded-3xl ${theme.border}`}
    >
      <div className="flex items-center justify-between mb-8">
        <h3 className={`text-xl font-bold font-display ${theme.text} uppercase tracking-widest`}>Zapisy Archiwisty Adeptus</h3>
        <button 
          onClick={handleClose} 
          className="text-slate-500 hover:text-slate-200 transition-colors"
        >
          <XCircle className="w-6 h-6" />
        </button>
      </div>

      <div className="space-y-6">
        {summary ? (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
            {[
              { label: "Dodano", count: summary.added?.length || 0, color: "text-emerald-400", bg: "bg-emerald-500/10" },
              { label: "Zaktualizowano", count: activeResult.updated || summary.updated?.length || 0, color: theme.text, bg: theme.bg },
              { label: "Pominięto", count: summary.skipped?.length || 0, color: "text-slate-400", bg: "bg-slate-500/10" },
              { label: "Duplikaty", count: summary.duplicates?.length || 0, color: "text-amber-400", bg: "bg-amber-500/10" }
            ].map((stat, i) => (
              <div key={i} className={`p-4 rounded-2xl ${stat.bg} border border-white/5`}>
                <div className="text-xs font-bold text-slate-500 uppercase tracking-widest mb-1">{stat.label}</div>
                <div className={`text-3xl font-bold font-display ${stat.color}`}>{stat.count}</div>
              </div>
            ))}
          </div>
        ) : (
          <div className={`p-6 ${theme.bg} border ${theme.border} rounded-2xl text-center mb-8`}>
            <div className={`${theme.text} font-bold uppercase tracking-widest mb-2`}>Rytuał Zakończony Pomyślnie</div>
            <div className="text-slate-400 text-sm">
              Przetworzono {activeResult.found || 0} woluminów. 
              Zaktualizowano {activeResult.updated || 0} wpisów.
            </div>
          </div>
        )}

        {summary && (summary.added?.length > 0 || summary.updated?.length > 0 || summary.duplicates?.length > 0) && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {summary.added?.length > 0 && (
              <div className="bg-slate-900/50 border border-slate-800 rounded-3xl p-6">
                <h4 className="text-sm font-bold text-emerald-400 uppercase tracking-widest mb-4 flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4" /> Nowe Zapisy ({summary.added.length})
                </h4>
                <div className="max-h-64 overflow-y-auto pr-2 custom-scrollbar space-y-2">
                  {summary.added.map((item: string, i: number) => (
                    <div key={i} className="text-xs text-slate-300 font-medium border-l-2 border-emerald-500/30 pl-3 py-1 bg-emerald-500/5 rounded-r-lg">
                      {item}
                    </div>
                  ))}
                </div>
              </div>
            )}
            {summary.updated?.length > 0 && (
              <div className="bg-slate-900/50 border border-slate-800 rounded-3xl p-6">
                <h4 className="text-sm font-bold text-cyan-400 uppercase tracking-widest mb-4 flex items-center gap-2">
                  <RefreshCw className="w-4 h-4" /> Zaktualizowane ({summary.updated.length})
                </h4>
                <div className="max-h-64 overflow-y-auto pr-2 custom-scrollbar space-y-2">
                  {summary.updated.map((item: string, i: number) => (
                    <div key={i} className="text-xs text-slate-300 font-medium border-l-2 border-cyan-500/30 pl-3 py-1 bg-cyan-500/5 rounded-r-lg">
                      {item}
                    </div>
                  ))}
                </div>
              </div>
            )}
            {summary.duplicates?.length > 0 && (
              <div className="bg-slate-900/50 border border-slate-800 rounded-3xl p-6">
                <div className="flex items-center justify-between mb-4">
                  <h4 className="text-sm font-bold text-amber-400 uppercase tracking-widest flex items-center gap-2">
                    <AlertCircle className="w-4 h-4" /> Potencjalne Duplikaty ({summary.duplicates.length})
                  </h4>
                  <button 
                    onClick={handleCopyDuplicates}
                    className="p-2 hover:bg-amber-500/10 rounded-lg text-amber-400/60 hover:text-amber-400 transition-all"
                    title="Kopiuj listę duplikatów"
                    aria-label="Kopiuj listę duplikatów"
                  >
                    {copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                  </button>
                </div>
                <div className="max-h-64 overflow-y-auto pr-2 custom-scrollbar space-y-2">
                  {summary.duplicates.map((item: string, i: number) => (
                    <div key={i} className="text-xs text-slate-300 font-medium border-l-2 border-amber-500/30 pl-3 py-1 bg-amber-500/5 rounded-r-lg">
                      {item}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </motion.div>
  );
};
