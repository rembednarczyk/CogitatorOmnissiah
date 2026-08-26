import React, { useEffect, useState } from "react";
import { Database, Terminal, ArrowUp, XCircle, AlertTriangle, RefreshCw, Cog, ShoppingCart, ScrollText, Library } from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import { StatsSection } from "./components/StatsSection";
import { SearchSection } from "./components/SearchSection";
import { BookshelfSection } from "./components/BookshelfSection";
import { VintedSection } from "./components/VintedSection";
import { LiturgySection } from "./components/LiturgySection";
import { ConfigSection } from "./components/ConfigSection";
import { TabNav, TabDef } from "./components/TabNav";
import { ParticleBackground } from "./components/ParticleBackground";
import { useSyncManager } from "./hooks/useSyncManager";

type TabId = 'stats' | 'shelf' | 'search' | 'config' | 'vinted' | 'admin';

const tabTransition = { initial: { opacity: 0, y: 20 }, animate: { opacity: 1, y: 0 }, exit: { opacity: 0, y: -20 }, transition: { duration: 0.3 } };

export default function App() {
  const [activeTab, setActiveTab] = useState<TabId>('stats');
  const [showScrollTop, setShowScrollTop] = useState(false);

  // A single manager instance — its `anyError` feeds the global error card (visible
  // on every tab), and the same instance goes to LiturgySection via the `sm` prop.
  const sm = useSyncManager();
  const { anyError, isAnySyncLoading, handleResetSync } = sm;

  useEffect(() => {
    const handleScroll = () => setShowScrollTop(window.scrollY > 300);
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  const tabs: TabDef[] = [
    { id: 'stats', label: 'Statystyki Archiwum', icon: <Database className="w-5 h-5" />, activeClass: 'bg-cyan-500/20 border-cyan-500/50 text-cyan-400 shadow-[0_0_20px_rgba(34,211,238,0.2)]' },
    { id: 'shelf', label: 'Regał', icon: <Library className="w-5 h-5" />, activeClass: 'bg-amber-500/20 border-amber-500/50 text-amber-300 shadow-[0_0_20px_rgba(251,191,36,0.2)]' },
    { id: 'search', label: 'Skryptorium', icon: <ScrollText className="w-5 h-5" />, activeClass: 'bg-cyan-500/20 border-cyan-500/50 text-cyan-400 shadow-[0_0_20px_rgba(34,211,238,0.2)]' },
    { id: 'config', label: 'Liturgie Synchronizacji', icon: <Cog className={`w-5 h-5 ${isAnySyncLoading ? 'animate-spin text-purple-400' : ''}`} />, activeClass: 'bg-purple-500/20 border-purple-500/50 text-purple-400 shadow-[0_0_20px_rgba(168,85,247,0.2)]' },
    { id: 'vinted', label: 'Skaner Vinted', icon: <ShoppingCart className="w-5 h-5" />, activeClass: 'bg-rose-500/20 border-rose-500/50 text-rose-400 shadow-[0_0_20px_rgba(244,63,94,0.2)]' },
  ];

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
          {/* Logo = entry to the Sanktuarium Kalibracji (admin tab, outside the nav bar). */}
          <motion.button
            whileHover={{ scale: 1.05, rotate: 5 }}
            whileTap={{ scale: 0.95 }}
            onClick={() => setActiveTab(activeTab === 'admin' ? 'stats' : 'admin')}
            className={`p-5 bg-slate-900/80 rounded-2xl border shadow-2xl backdrop-blur-xl cursor-pointer transition-colors ${
              activeTab === 'admin' ? 'border-amber-500/50 shadow-amber-500/20' : 'border-cyan-500/30 shadow-cyan-500/20'
            }`}
            title="Sanktuarium Kalibracji (konfiguracja)"
            aria-label="Otwórz konfigurację"
          >
            <Database className={`w-12 h-12 ${activeTab === 'admin' ? 'text-amber-400' : 'text-cyan-400'}`} />
          </motion.button>
          <div className="flex-1">
            <h1 className="text-4xl md:text-5xl font-bold tracking-tighter font-display mb-2 flex items-center justify-center md:justify-start gap-3 flex-wrap">
              <span className="bg-clip-text text-transparent bg-gradient-to-r from-cyan-400 via-blue-500 to-purple-600 drop-shadow-[0_0_20px_rgba(34,211,238,0.3)]">
                COGITATOR OMNISSIAH
              </span>
              <span className="text-[10px] font-mono font-bold tracking-widest text-cyan-400/70 bg-cyan-500/10 border border-cyan-500/20 rounded-full px-2 py-0.5 self-center" title="Wersja rytuału">
                v{__APP_VERSION__}
              </span>
            </h1>
            <p className="text-slate-400 text-lg font-medium tracking-wide uppercase flex items-center justify-center md:justify-start gap-2">
              <Terminal className="w-4 h-4 text-purple-500" />
              Protokół Synchronizacji Danych Archiwalnych
            </p>
          </div>
        </motion.header>

        <TabNav tabs={tabs} active={activeTab} onSelect={(id) => setActiveTab(id as TabId)} />

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
                  <p className="text-red-400 text-sm font-medium">{anyError.state.error}</p>
                </div>
                <button onClick={() => anyError.reset()} className="p-2 hover:bg-red-500/10 rounded-xl text-red-400 transition-colors">
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
                  <p className="text-[10px] text-red-400 mt-2 italic">Użyj tej opcji, jeśli jesteś pewien, że żadna inna synchronizacja nie jest aktualnie uruchomiona.</p>
                </div>
              )}
            </motion.div>
          )}
        </AnimatePresence>

        {/* Main Content Area */}
        <AnimatePresence mode="wait">
          {activeTab === 'stats' ? (
            <motion.div key="stats" {...tabTransition}><StatsSection /></motion.div>
          ) : activeTab === 'shelf' ? (
            <motion.div key="shelf" {...tabTransition}><BookshelfSection /></motion.div>
          ) : activeTab === 'search' ? (
            <motion.div key="search" {...tabTransition}><SearchSection /></motion.div>
          ) : activeTab === 'config' ? (
            <motion.div key="config" {...tabTransition} className="space-y-12"><LiturgySection sm={sm} /></motion.div>
          ) : activeTab === 'admin' ? (
            <motion.div key="admin" {...tabTransition}><ConfigSection /></motion.div>
          ) : (
            <motion.div key="vinted" {...tabTransition}><VintedSection /></motion.div>
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
