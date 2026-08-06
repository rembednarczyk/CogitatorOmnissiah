import React, { useEffect, useState } from "react";
import { Database, Terminal, ArrowUp, XCircle, AlertTriangle, RefreshCw, Cog, ShoppingCart } from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import { StatsSection } from "./components/StatsSection";
import { VintedSection } from "./components/VintedSection";
import { StatusSection } from "./components/StatusSection";
import { SyncAwards } from "./components/SyncAwards";
import { OtherToolsCard } from "./components/OtherToolsCard";
import { ProgressAndResults } from "./components/ProgressAndResults";
import { SyncSummaryResult } from "./components/SyncSummaryResult";
import { SchemaSection } from "./components/SchemaSection";
import { SanctityDebugger } from "./components/SanctityDebugger";
import { ParticleBackground } from "./components/ParticleBackground";
import { PREDEFINED_AWARDS } from "./constants";
import { useSync } from "./hooks/useSync";
import { useConfig } from "./hooks/useConfig";
import { formatETA } from "./utils/time";
import { IntegrityCheckResult } from "./types";

export default function App() {
  const { configStatus, schema, schemaLoading, schemaError, fetchSchema } = useConfig();
  const [activeTab, setActiveTab] = useState<'stats' | 'config' | 'vinted'>('stats');
  const [showScrollTop, setShowScrollTop] = useState(false);
  const [fullSyncResults, setFullSyncResults] = useState<any[] | null>(null);

  useEffect(() => {
    const handleScroll = () => {
      setShowScrollTop(window.scrollY > 300);
    };
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  const sync = useSync("/api/sync", "/api/sync/stop", {
    awardName: PREDEFINED_AWARDS[0].name,
    pageTitle: PREDEFINED_AWARDS[0].title,
    color: "cyan"
  });
  const publisherSync = useSync("/api/sync-publisher", "/api/sync-publisher/stop", { color: "rose" });
  const seriesSync = useSync("/api/sync-series", "/api/sync-series/stop", { color: "indigo" });
  const cyclesSync = useSync("/api/sync-cycles", "/api/sync-cycles/stop", { color: "blue" });
  const lpSync = useSync("/api/sync-lp", "/api/sync-lp/stop", { color: "purple" });
  const integritySync = useSync("/api/sync-integrity", "/api/sync-integrity/stop", { color: "cyan" });
  const duplicatesSync = useSync("/api/sync-duplicates", "/api/sync-duplicates/stop", { color: "orange" });
  const purifySync = useSync("/api/sync-purify", "/api/sync-purify/stop", { color: "amber" });
  const schemaSync = useSync("/api/sync-schema", "/api/sync-schema/stop", { color: "emerald" });

  const handleAwardChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const selectedName = e.target.value;
    const predefined = PREDEFINED_AWARDS.find(a => a.name === selectedName);
    
    sync.setState(prev => ({
      ...prev,
      awardName: selectedName,
      pageTitle: predefined ? predefined.title : (selectedName === "Wszystkie Nagrody" ? "" : prev.pageTitle)
    }));
  };

  const syncs = [sync, publisherSync, seriesSync, cyclesSync, lpSync, duplicatesSync, purifySync, schemaSync, integritySync];
  const anyError = syncs.find(s => s.state.error);

  const clearOthers = (currentSync: any) => {
    syncs.forEach(s => {
      if (s !== currentSync) {
        s.reset();
      }
    });
  };

  const handleSyncAction = async (syncService: any, params: any = {}, statusMessage: string | null = null) => {
    setFullSyncResults(null);
    clearOthers(syncService);
    return await syncService.startSync(params, undefined, statusMessage);
  };

  const handleSyncSchema = () => handleSyncAction(schemaSync);
  const handleSyncPurify = () => handleSyncAction(purifySync);
  const handleSyncPublisher = () => handleSyncAction(publisherSync);
  const handleSyncSeries = () => handleSyncAction(seriesSync);
  const handleCyclesSync = () => handleSyncAction(cyclesSync);
  const handleSyncLp = () => handleSyncAction(lpSync);

  const handleSync = () => {
    const isSyncAll = sync.state.awardName === "Wszystkie Nagrody";
    handleSyncAction(sync, {
      awardName: sync.state.awardName,
      pageTitle: sync.state.pageTitle,
      syncAll: isSyncAll
    });
  };

  const handleFullSync = async () => {
    setFullSyncResults(null);
    const results: any[] = [];
    
    // 1. Schema Initiation
    clearOthers(schemaSync);
    const res1 = await schemaSync.startSync({}, undefined, "Krok 1/7: Rytuał Inicjacji Schematu...");
    if (!res1) return;
    results.push({ name: "Schemat", result: res1, color: "emerald" });

    // 2. Purification
    clearOthers(purifySync);
    const res2 = await purifySync.startSync({}, undefined, "Krok 2/7: Rytuał Puryfikacji...");
    if (!res2) return;
    results.push({ name: "Puryfikacja", result: res2, color: "amber" });

    // 3. Sync Awards (Wszystkie)
    clearOthers(sync);
    const res3 = await sync.startSync({
      awardName: "Wszystkie Nagrody",
      syncAll: true
    }, undefined, "Krok 3/7: Synchronizacja Nagród...");
    if (!res3) return;
    results.push({ name: "Nagrody", result: res3, color: "cyan" });

    // 4. Cycles Marking
    clearOthers(cyclesSync);
    const res4 = await cyclesSync.startSync({}, undefined, "Krok 4/7: Rytuał Oznaczania Cykli...");
    if (!res4) return;
    results.push({ name: "Cykle", result: res4, color: "blue" });

    // 5. Publisher Sync
    clearOthers(publisherSync);
    const res5 = await publisherSync.startSync({}, undefined, "Krok 5/7: Rytuał Wydania...");
    if (!res5) return;
    results.push({ name: "Wydawcy", result: res5, color: "rose" });

    // 6. Series Sync
    clearOthers(seriesSync);
    const res6 = await seriesSync.startSync({}, undefined, "Krok 6/7: Rytuał Seryjny...");
    if (!res6) return;
    results.push({ name: "Serie", result: res6, color: "indigo" });

    // 7. Numbers Reconstruction (Lp)
    clearOthers(lpSync);
    const res7 = await lpSync.startSync({}, undefined, "Krok 7/7: Rytuał Rekonstrukcji Liczb...");
    if (res7) {
      results.push({ name: "Lubimy Czytać", result: res7, color: "purple" });
    }

    setFullSyncResults(results);
  };
  
  const handleResetSync = async () => {
    try {
      await fetch("/api/sync/reset", { method: "POST" });
      syncs.forEach(s => s.reset());
    } catch (err) {
      console.error("Reset Error:", err);
    }
  };

  const handleSyncDuplicates = () => {
    clearOthers(duplicatesSync);
    duplicatesSync.startSync({}, (result) => {
      const duplicatesFormatted = result.duplicates.map((d: any) => 
        `${d.bookA} <-> ${d.bookB} (${d.reason})`
      );
      return { 
        ...result,
        summary: { duplicates: duplicatesFormatted }
      };
    }, null);
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-200 font-sans selection:bg-cyan-500/30 selection:text-white relative overflow-hidden">
      <ParticleBackground />
      
      <div className="relative z-10 max-w-5xl mx-auto px-6 py-16 space-y-12">
        {/* Header */}
        <motion.header 
          initial={{ opacity: 0, y: -30 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex flex-col md:flex-row items-center gap-8 text-center md:text-left"
        >
          <motion.div 
            whileHover={{ scale: 1.05, rotate: 5 }}
            className="p-5 bg-slate-900/80 rounded-2xl border border-cyan-500/30 shadow-2xl shadow-cyan-500/20 backdrop-blur-xl"
          >
            <Database className="w-12 h-12 text-cyan-400" />
          </motion.div>
          <div className="flex-1">
            <h1 className="text-4xl md:text-5xl font-bold tracking-tighter font-display mb-2">
              <span className="bg-clip-text text-transparent bg-gradient-to-r from-cyan-400 via-blue-500 to-purple-600 drop-shadow-[0_0_20px_rgba(34,211,238,0.3)]">
                COGITATOR OMNISSIAH
              </span>
            </h1>
            <p className="text-slate-400 text-lg font-medium tracking-wide uppercase flex items-center justify-center md:justify-start gap-2">
              <Terminal className="w-4 h-4 text-purple-500" />
              Protokół Synchronizacji Danych Archiwalnych
            </p>
          </div>
        </motion.header>

        {/* Tab Navigation */}
        <div className="flex flex-col sm:flex-row items-center justify-center gap-4 mt-8">
          <button
            onClick={() => setActiveTab('stats')}
            className={`w-full sm:w-auto px-8 py-4 rounded-2xl border font-bold uppercase tracking-widest text-sm transition-all flex items-center justify-center gap-3 ${
              activeTab === 'stats' 
                ? 'bg-cyan-500/20 border-cyan-500/50 text-cyan-400 shadow-[0_0_20px_rgba(34,211,238,0.2)]' 
                : 'bg-slate-900/50 border-slate-800 text-slate-500 hover:text-slate-300 hover:bg-slate-800/50'
            }`}
          >
            <Database className="w-5 h-5" />
            Statystyki Archiwum
          </button>
          <button
            onClick={() => setActiveTab('config')}
            className={`w-full sm:w-auto px-8 py-4 rounded-2xl border font-bold uppercase tracking-widest text-sm transition-all flex items-center justify-center gap-3 ${
              activeTab === 'config' 
                ? 'bg-purple-500/20 border-purple-500/50 text-purple-400 shadow-[0_0_20px_rgba(168,85,247,0.2)]' 
                : 'bg-slate-900/50 border-slate-800 text-slate-500 hover:text-slate-300 hover:bg-slate-800/50'
            }`}
          >
            <Cog className={`w-5 h-5 ${syncs.some(s => s.state.loading) ? 'animate-spin text-purple-400' : ''}`} />
            Liturgie Synchronizacji
          </button>
          <button
            onClick={() => setActiveTab('vinted')}
            className={`w-full sm:w-auto px-8 py-4 rounded-2xl border font-bold uppercase tracking-widest text-sm transition-all flex items-center justify-center gap-3 ${
              activeTab === 'vinted' 
                ? 'bg-rose-500/20 border-rose-500/50 text-rose-400 shadow-[0_0_20px_rgba(244,63,94,0.2)]' 
                : 'bg-slate-900/50 border-slate-800 text-slate-500 hover:text-slate-300 hover:bg-slate-800/50'
            }`}
          >
            <ShoppingCart className="w-5 h-5" />
            Skaner Vinted
          </button>
        </div>

        {/* Global Error Display */}
        <AnimatePresence>
          {anyError && (
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="glass-card p-6 border-red-500/30 bg-red-500/5 rounded-3xl space-y-4"
            >
              <div className="flex items-start gap-4">
                <div className="p-3 bg-red-500/20 rounded-2xl text-red-400">
                  <AlertTriangle className="w-6 h-6" />
                </div>
                <div className="flex-1">
                  <h3 className="text-lg font-bold text-red-200 uppercase tracking-widest mb-1">Błąd Synchronizacji</h3>
                  <p className="text-red-400/80 text-sm font-medium">{anyError.state.error}</p>
                </div>
                <button 
                  onClick={() => anyError.reset()}
                  className="p-2 hover:bg-red-500/10 rounded-xl text-red-400 transition-colors"
                >
                  <XCircle className="w-5 h-5" />
                </button>
              </div>
              
              {anyError.state.error?.includes("Inna synchronizacja") && (
                <div className="pt-2">
                  <button 
                    onClick={handleResetSync}
                    className="flex items-center gap-2 px-6 py-2 bg-red-500/20 hover:bg-red-500/30 border border-red-500/40 rounded-xl text-red-200 text-xs font-bold uppercase tracking-widest transition-all"
                  >
                    <RefreshCw className="w-4 h-4" />
                    Wymuś Reset Stanu
                  </button>
                  <p className="text-[10px] text-red-500/60 mt-2 italic">Użyj tej opcji, jeśli jesteś pewien, że żadna inna synchronizacja nie jest aktualnie uruchomiona.</p>
                </div>
              )}
            </motion.div>
          )}
        </AnimatePresence>

        {/* Main Content Area */}
        <AnimatePresence mode="wait">
          {activeTab === 'stats' ? (
            <motion.div
              key="stats"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              transition={{ duration: 0.3 }}
            >
              <StatsSection />
            </motion.div>
          ) : activeTab === 'config' ? (
            <motion.div
              key="config"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              transition={{ duration: 0.3 }}
              className="space-y-12"
            >
              <div className="flex items-center gap-6 mb-12">
                <div className="h-px flex-1 bg-gradient-to-r from-transparent via-purple-500/20 to-transparent"></div>
                <div className="flex items-center gap-4">
                  <Cog className="w-6 h-6 text-purple-400" />
                  <h2 className="text-xl font-bold font-display uppercase tracking-[0.4em] text-purple-100/90 whitespace-nowrap">
                    Liturgie Synchronizacji
                  </h2>
                </div>
                <div className="h-px flex-1 bg-gradient-to-r from-transparent via-purple-500/20 to-transparent"></div>
              </div>

              {/* Status Section */}
              <StatusSection configStatus={configStatus} />
              
              {/* Main Actions Grid */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                {/* Sync Awards Card */}
                <SyncAwards 
                  sync={sync}
                  integritySync={integritySync}
                  handleAwardChange={handleAwardChange}
                  handleSync={handleSync}
                  handleFullSync={handleFullSync}
                  isAnySyncLoading={syncs.some(s => s.state.loading)}
                />

                {/* Other Tools Card */}
                <OtherToolsCard 
                  schemaSync={schemaSync}
                  purifySync={purifySync}
                  publisherSync={publisherSync}
                  seriesSync={seriesSync}
                  cyclesSync={cyclesSync}
                  duplicatesSync={duplicatesSync}
                  lpSync={lpSync}
                  handleSyncSchema={handleSyncSchema}
                  handleSyncPurify={handleSyncPurify}
                  handleSyncPublisher={handleSyncPublisher}
                  handleSyncSeries={handleSyncSeries}
                  handleCyclesSync={handleCyclesSync}
                  handleSyncDuplicates={handleSyncDuplicates}
                  handleSyncLp={handleSyncLp}
                  handleResetSync={handleResetSync}
                  isAnySyncLoading={syncs.some(s => s.state.loading)}
                />
              </div>

              {/* Progress and Results */}
              <AnimatePresence>
                <ProgressAndResults 
                  syncs={syncs}
                  formatETA={formatETA}
                />
              </AnimatePresence>

              {/* Sync Summary Result */}
              <AnimatePresence>
                <SyncSummaryResult 
                  syncs={syncs}
                  fullSyncResults={fullSyncResults}
                />
              </AnimatePresence>

              {/* Sanctity Debugger */}
              <SanctityDebugger 
                result={integritySync.state.result as IntegrityCheckResult | null} 
              />

              {/* Schema Section */}
              <SchemaSection 
                schema={schema}
                schemaLoading={schemaLoading}
                schemaError={schemaError}
                configStatus={configStatus}
                fetchSchema={fetchSchema}
              />
            </motion.div>
          ) : (
            <motion.div
              key="vinted"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              transition={{ duration: 0.3 }}
            >
              <VintedSection />
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Scroll to Top Button */}
      <AnimatePresence>
        {showScrollTop && (
          <motion.button
            initial={{ opacity: 0, y: 20, scale: 0.8 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 20, scale: 0.8 }}
            whileHover={{ scale: 1.1 }}
            whileTap={{ scale: 0.9 }}
            onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
            className="fixed bottom-8 right-8 p-4 bg-cyan-500/20 hover:bg-cyan-500/30 border border-cyan-500/50 text-cyan-400 rounded-full shadow-[0_0_15px_rgba(34,211,238,0.3)] backdrop-blur-md z-50 transition-colors"
            title="Powrót na górę"
            aria-label="Powrót na górę"
          >
            <ArrowUp className="w-6 h-6" />
          </motion.button>
        )}
      </AnimatePresence>
    </div>
  );
}
