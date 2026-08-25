import React from "react";
import { BookOpen, Loader2, RefreshCw } from "lucide-react";
import { motion } from "motion/react";
import { useSync } from "../hooks/useSync";
import { AwardPage } from "../configSchema";
import { IntegrityCheckCard } from "./IntegrityCheckCard";

interface SyncAwardsProps {
  sync: ReturnType<typeof useSync>;
  /** Lista nagród z konfiguracji (+ „Wszystkie Nagrody") — dropdown. */
  awardOptions: AwardPage[];
  integritySync: ReturnType<typeof useSync>;
  handleAwardChange: (name: string) => void;
  handleSync: () => void;
  handleFullSync: () => void;
  isAnySyncLoading: boolean;
}

export const SyncAwards: React.FC<SyncAwardsProps> = ({ 
  sync, 
  awardOptions,
  integritySync,
  handleAwardChange, 
  handleSync, 
  handleFullSync,
  isAnySyncLoading
}) => {
  const syncState = sync.state;
  const setSyncState = sync.setState;
  return (
    <motion.div 
      initial={{ opacity: 0, x: -20 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ delay: 0.4 }}
      className="glass-card p-8 rounded-3xl flex flex-col h-full"
    >
      <h2 className="text-xl font-bold font-display flex items-center gap-3 mb-6 uppercase tracking-widest text-purple-400">
        <BookOpen className="w-5 h-5" />
        Rytuał Synchronizacji Nagród
      </h2>
      
      <div className="space-y-6 flex-1">
        <div className="space-y-2">
          <label htmlFor="award-select" className="text-xs font-bold text-slate-500 uppercase tracking-widest ml-1">Wybierz Nagrodę do Synchronizacji</label>
          <select 
            id="award-select"
            value={syncState.awardName || ""} 
            onChange={(e) => handleAwardChange(e.target.value)}
            disabled={syncState.loading}
            className="w-full bg-slate-950 border border-slate-800 rounded-2xl px-4 py-3 text-slate-200 focus:ring-2 focus:ring-cyan-500/50 focus:border-cyan-500/50 outline-none transition-all disabled:opacity-50 font-medium"
          >
            {awardOptions.map(a => (
              <option key={a.name} value={a.name}>{a.name}</option>
            ))}
            <option value="Inna">Inna (wpisz poniżej)</option>
          </select>
        </div>

        {syncState.awardName !== "Wszystkie Nagrody" && (
          <div className="space-y-2">
            <label className="text-xs font-bold text-slate-500 uppercase tracking-widest ml-1">Tytuł Strony w Archiwum Encyklopedii</label>
            <input 
              type="text" 
              value={syncState.pageTitle || ""} 
              onChange={(e) => setSyncState(prev => ({ ...prev, pageTitle: e.target.value }))}
              disabled={syncState.loading}
              placeholder="np. Hugo nagroda powieść"
              className="w-full bg-slate-950 border border-slate-800 rounded-2xl px-4 py-3 text-slate-200 focus:ring-2 focus:ring-purple-500/50 focus:border-purple-500/50 outline-none transition-all disabled:opacity-50 font-medium"
            />
          </div>
        )}

        <div className="flex flex-col gap-3 pt-4">
          <button 
            onClick={() => handleSync()} 
            disabled={isAnySyncLoading || (syncState.awardName !== "Wszystkie Nagrody" && !syncState.pageTitle)}
            className="w-full flex items-center justify-center gap-2 px-6 py-3.5 bg-gradient-to-r from-cyan-600 to-blue-700 hover:from-cyan-500 hover:to-blue-600 text-white rounded-2xl font-bold shadow-xl shadow-cyan-500/20 hover:-translate-y-1 transition-all active:scale-95 disabled:opacity-50 disabled:hover:translate-y-0"
          >
            {syncState.loading ? <Loader2 className="w-5 h-5 animate-spin" /> : <RefreshCw className="w-5 h-5" />}
            Inicjuj Synchronizację
          </button>

          <button 
            onClick={() => handleFullSync()} 
            disabled={isAnySyncLoading}
            className="w-full flex flex-col items-center justify-center gap-1 px-6 py-4 bg-slate-900/50 border border-purple-500/30 hover:border-purple-400/60 text-purple-400 rounded-2xl font-bold shadow-xl shadow-purple-500/10 hover:-translate-y-1 transition-all active:scale-95 disabled:opacity-50 disabled:hover:translate-y-0"
          >
            <div className="flex items-center gap-2">
              <RefreshCw className={`w-4 h-4 ${isAnySyncLoading ? 'animate-spin' : ''}`} />
              Rytuał Pełnej Synchronizacji
            </div>
            <span className="text-[10px] text-slate-500 uppercase tracking-widest font-medium">Sekwencja 1-7 (Schemat → Puryfikacja → Nagrody → Cykle → Wydania → Serie → Liczby)</span>
          </button>
        </div>

        <IntegrityCheckCard 
          integritySync={integritySync}
          isAnySyncLoading={isAnySyncLoading}
        />
      </div>
    </motion.div>
  );
};
