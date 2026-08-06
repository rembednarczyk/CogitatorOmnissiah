import React from "react";
import { Settings, Search, RefreshCw, AlertTriangle, Sparkles, Database, BookOpen, Layers } from "lucide-react";
import { motion } from "motion/react";
import { useSync } from "../hooks/useSync";

interface OtherToolsCardProps {
  schemaSync: ReturnType<typeof useSync>;
  purifySync: ReturnType<typeof useSync>;
  publisherSync: ReturnType<typeof useSync>;
  seriesSync: ReturnType<typeof useSync>;
  cyclesSync: ReturnType<typeof useSync>;
  duplicatesSync: ReturnType<typeof useSync>;
  lpSync: ReturnType<typeof useSync>;
  handleSyncSchema: () => void;
  handleSyncPurify: () => void;
  handleSyncPublisher: () => void;
  handleSyncSeries: () => void;
  handleCyclesSync: () => void;
  handleSyncDuplicates: () => void;
  handleSyncLp: () => void;
  handleResetSync?: () => void;
  isAnySyncLoading: boolean;
}

export const OtherToolsCard: React.FC<OtherToolsCardProps> = ({
  schemaSync,
  purifySync,
  publisherSync,
  seriesSync,
  cyclesSync,
  duplicatesSync,
  lpSync,
  handleSyncSchema,
  handleSyncPurify,
  handleSyncPublisher,
  handleSyncSeries,
  handleCyclesSync,
  handleSyncDuplicates,
  handleSyncLp,
  handleResetSync,
  isAnySyncLoading
}) => {
  const schemaSyncState = schemaSync.state;
  const purifySyncState = purifySync.state;
  const publisherSyncState = publisherSync.state;
  const seriesSyncState = seriesSync.state;
  const cyclesSyncState = cyclesSync.state;
  const duplicatesSyncState = duplicatesSync.state;
  const lpSyncState = lpSync.state;
  return (
    <motion.div 
      initial={{ opacity: 0, x: 20 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ delay: 0.5 }}
      className="glass-card p-8 rounded-3xl flex flex-col h-full"
    >
      <h2 className="text-xl font-bold font-display flex items-center gap-3 mb-6 uppercase tracking-widest text-cyan-400">
        <Settings className="w-5 h-5" />
        Narzędzia Serwomechanizmów Adeptus
      </h2>
      
      <div className="grid grid-cols-1 gap-4 flex-1">
        {/* 1. Rytuał Inicjacji Schematu */}
        <button 
          onClick={handleSyncSchema} 
          disabled={isAnySyncLoading}
          className="flex items-center gap-4 p-4 bg-slate-950/50 border border-slate-800 rounded-2xl hover:border-emerald-500/50 hover:bg-slate-900/50 transition-all duration-200 hover:scale-[1.02] active:scale-[0.98] hover:shadow-lg hover:shadow-emerald-500/10 group disabled:opacity-50 disabled:hover:scale-100"
        >
          <div className="p-3 bg-slate-900 rounded-xl group-hover:bg-emerald-500/20 transition-colors">
            <Database className={`w-5 h-5 text-emerald-400 ${schemaSyncState.loading ? 'animate-pulse' : ''}`} />
          </div>
          <div className="text-left">
            <h3 className="font-bold text-slate-200 group-hover:text-emerald-400 transition-colors">Rytuał Inicjacji Schematu</h3>
            <p className="text-xs text-slate-500 mt-1 uppercase font-bold tracking-tighter">Weryfikacja i kreacja brakujących kolumn w bazie Notion</p>
          </div>
        </button>

        {/* 2. Rytuał Puryfikacji */}
        <button 
          onClick={handleSyncPurify} 
          disabled={isAnySyncLoading}
          className="flex items-center gap-4 p-4 bg-slate-950/50 border border-slate-800 rounded-2xl hover:border-amber-500/50 hover:bg-slate-900/50 transition-all duration-200 hover:scale-[1.02] active:scale-[0.98] hover:shadow-lg hover:shadow-amber-500/10 group disabled:opacity-50 disabled:hover:scale-100"
        >
          <div className="p-3 bg-slate-900 rounded-xl group-hover:bg-amber-500/20 transition-colors">
            <Sparkles className={`w-5 h-5 text-amber-400 ${purifySyncState.loading ? 'animate-pulse' : ''}`} />
          </div>
          <div className="text-left">
            <h3 className="font-bold text-slate-200 group-hover:text-amber-400 transition-colors">Rytuał Puryfikacji</h3>
            <p className="text-xs text-slate-500 mt-1 uppercase font-bold tracking-tighter">Oczyszczanie tytułów z nadmiarowych znaków i formatowania</p>
          </div>
        </button>

        {/* 3. Rytuał Rekonstrukcji Liczb */}
        <button 
          onClick={handleSyncLp} 
          disabled={isAnySyncLoading}
          className="flex items-center gap-4 p-4 bg-slate-950/50 border border-slate-800 rounded-2xl hover:border-purple-500/50 hover:bg-slate-900/50 transition-all duration-200 hover:scale-[1.02] active:scale-[0.98] hover:shadow-lg hover:shadow-purple-500/10 group disabled:opacity-50 disabled:hover:scale-100"
        >
          <div className="p-3 rounded-xl bg-purple-500/10 text-purple-400 group-hover:scale-110 transition-transform">
            <RefreshCw className={`w-5 h-5 ${lpSyncState.loading ? 'animate-spin' : ''}`} />
          </div>
          <div className="text-left">
            <div className="font-bold text-slate-200 group-hover:text-purple-400 transition-colors">Rytuał Rekonstrukcji Liczb</div>
            <div className="text-xs text-slate-500 uppercase font-bold tracking-tighter">Rekalkulacja i naprawa numeracji porządkowej rekordów</div>
          </div>
        </button>

        {/* 4. Rytuał Oznaczania Cykli */}
        <button 
          onClick={handleCyclesSync} 
          disabled={isAnySyncLoading}
          className="flex items-center gap-4 p-4 bg-slate-950/50 border border-slate-800 rounded-2xl hover:border-blue-500/50 hover:bg-slate-900/50 transition-all duration-200 hover:scale-[1.02] active:scale-[0.98] hover:shadow-lg hover:shadow-blue-500/10 group disabled:opacity-50 disabled:hover:scale-100"
        >
          <div className="p-3 rounded-xl bg-blue-500/10 text-blue-400 group-hover:scale-110 transition-transform">
            <RefreshCw className={`w-5 h-5 ${cyclesSyncState.loading ? 'animate-spin' : ''}`} />
          </div>
          <div className="text-left">
            <div className="font-bold text-slate-200 group-hover:text-blue-400 transition-colors">Rytuał Oznaczania Cykli</div>
            <div className="text-xs text-slate-500 uppercase font-bold tracking-tighter">Automatyczne przypisywanie książek do cykli wydawniczych</div>
          </div>
        </button>

        {/* 5. Rytuał Wydania */}
        <button 
          onClick={handleSyncPublisher} 
          disabled={isAnySyncLoading}
          className="flex items-center gap-4 p-4 bg-slate-950/50 border border-slate-800 rounded-2xl hover:border-rose-500/50 hover:bg-slate-900/50 transition-all duration-200 hover:scale-[1.02] active:scale-[0.98] hover:shadow-lg hover:shadow-rose-500/10 group disabled:opacity-50 disabled:hover:scale-100"
        >
          <div className="p-3 rounded-xl bg-rose-500/10 text-rose-400 group-hover:scale-110 transition-transform">
            <BookOpen className={`w-5 h-5 ${publisherSyncState.loading ? 'animate-pulse' : ''}`} />
          </div>
          <div className="text-left">
            <div className="font-bold text-slate-200 group-hover:text-rose-400 transition-colors">Rytuał Wydania</div>
            <div className="text-xs text-slate-500 uppercase font-bold tracking-tighter">Eksploracja i aktualizacja danych o wydawcach z Encyklopedii</div>
          </div>
        </button>

        {/* 6. Rytuał Seryjny */}
        <button 
          onClick={handleSyncSeries} 
          disabled={isAnySyncLoading}
          className="flex items-center gap-4 p-4 bg-slate-950/50 border border-slate-800 rounded-2xl hover:border-indigo-500/50 hover:bg-slate-900/50 transition-all duration-200 hover:scale-[1.02] active:scale-[0.98] hover:shadow-lg hover:shadow-indigo-500/10 group disabled:opacity-50 disabled:hover:scale-100"
        >
          <div className="p-3 rounded-xl bg-indigo-500/10 text-indigo-400 group-hover:scale-110 transition-transform">
            <Layers className={`w-5 h-5 ${seriesSyncState.loading ? 'animate-pulse' : ''}`} />
          </div>
          <div className="text-left">
            <div className="font-bold text-slate-200 group-hover:text-indigo-400 transition-colors">Rytuał Seryjny</div>
            <div className="text-xs text-slate-500 uppercase font-bold tracking-tighter">Eksploracja i aktualizacja danych o seriach wydawniczych</div>
          </div>
        </button>

        {/* 7. Rytuał Wykrycia Duplikacji */}
        <button 
          onClick={handleSyncDuplicates} 
          disabled={isAnySyncLoading}
          className="flex items-center gap-4 p-4 bg-slate-950/50 border border-slate-800 rounded-2xl hover:border-orange-500/50 hover:bg-slate-900/50 transition-all duration-200 hover:scale-[1.02] active:scale-[0.98] hover:shadow-lg hover:shadow-orange-500/10 group disabled:opacity-50 disabled:hover:scale-100"
        >
          <div className="p-3 rounded-xl bg-orange-500/10 text-orange-400 group-hover:scale-110 transition-transform">
            <Search className={`w-5 h-5 ${duplicatesSyncState.loading ? 'animate-pulse' : ''}`} />
          </div>
          <div className="text-left">
            <div className="font-bold text-slate-200 group-hover:text-orange-400 transition-colors">Rytuał Wykrycia Duplikacji</div>
            <div className="text-xs text-slate-500 uppercase font-bold tracking-tighter">Identyfikacja i oznaczanie potencjalnych duplikatów w bazie</div>
          </div>
        </button>
      </div>

      {handleResetSync && (
        <div className="mt-8 pt-6 border-t border-slate-800/50">
          <button 
            onClick={handleResetSync}
            className="w-full flex items-center justify-center gap-2 p-3 bg-red-950/20 border border-red-900/30 rounded-xl text-red-400 hover:bg-red-900/30 hover:border-red-500/50 transition-all text-xs font-bold uppercase tracking-widest"
          >
            <AlertTriangle className="w-4 h-4" />
            Resetuj Stan Synchronizacji
          </button>
          <p className="text-[10px] text-slate-600 mt-2 text-center italic">Użyj tylko jeśli proces utknął w martwym punkcie.</p>
        </div>
      )}
    </motion.div>
  );
};
