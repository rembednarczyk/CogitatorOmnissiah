import React from "react";
import { motion } from "motion/react";
import { Book, BarChart3, Award, User, Calendar, Package, RefreshCw, Library, Search } from "lucide-react";
import { useStats } from "../hooks/useStats";
import { useLibraryCheck } from "../hooks/useLibraryCheck";
import { useMarkAsRead } from "../hooks/useMarkAsRead";
import { ProgressBar } from "./stats/ProgressBar";
import { YearlyProgressItem } from "./stats/YearlyProgressItem";
import { LibraryProgressItem } from "./stats/LibraryProgressItem";
import { AuthorProgressItem } from "./stats/AuthorProgressItem";
import { IdentifiedLibraryItem } from "./stats/IdentifiedLibraryItem";
import { OwnedUnreadItem } from "./stats/OwnedUnreadItem";
import { AwardCoverageGrid } from "./stats/AwardCoverageGrid";
import { AvailabilityCard } from "./stats/AvailabilityCard";
import { PublishingCard } from "./stats/PublishingCard";
import { DecadeHistogram } from "./stats/DecadeHistogram";
import { useEffectiveConfig } from "../hooks/useAppConfig";

export const StatsSection: React.FC = () => {
  // Filie biblioteczne z konfiguracji (fallback: defaulty do czasu pobrania).
  const branches = useEffectiveConfig().library.branches;
  const { stats, loading, error, fetchStats, addBookToLibrarySection } = useStats();
  const { identifiedBooks, checkingLibrary, checkProgress, libraryError, checkLibrary, checkAllLibraries, stopLibraryCheck } = useLibraryCheck();
  const { markingId, markedIds, markAsRead } = useMarkAsRead({ identifiedBooks, addBookToLibrarySection, fetchStats });

  if (loading && !stats) {
    return (
      <div className="flex flex-col items-center justify-center p-12 space-y-4">
        <motion.div 
          animate={{ rotate: 360 }}
          transition={{ repeat: Infinity, duration: 2, ease: "linear" }}
          className="text-cyan-500"
        >
          <BarChart3 className="w-12 h-12" />
        </motion.div>
        <p className="text-cyan-400 font-display uppercase tracking-widest animate-pulse">Analiza Logów Archiwalnych...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-8 glass-card border-red-500/30 text-center">
        <p className="text-red-400 font-bold mb-4">Błąd Odczytu Danych: {error}</p>
        <button 
          onClick={fetchStats}
          className="px-6 py-2 bg-red-900/40 hover:bg-red-800/60 text-red-200 rounded-xl border border-red-700/30 transition-all"
        >
          Ponów Próbę Odczytu
        </button>
      </div>
    );
  }

  if (!stats) return null;

  return (
    <div className="space-y-12">
      <div className="flex items-center gap-6 mb-12">
        <div className="h-px flex-1 bg-gradient-to-r from-transparent via-cyan-500/20 to-transparent"></div>
        <div className="flex items-center gap-4">
          <BarChart3 className="w-6 h-6 text-cyan-400" />
          <h2 className="text-xl font-bold font-display uppercase tracking-[0.4em] text-cyan-100/90 whitespace-nowrap">
            Analiza Zasobów Wiedzy
          </h2>
        </div>
        <div className="h-px flex-1 bg-gradient-to-r from-transparent via-cyan-500/20 to-transparent"></div>
        
        <button 
          onClick={fetchStats}
          disabled={loading}
          className="p-2 hover:bg-slate-900 rounded-lg text-slate-500 hover:text-cyan-400 transition-colors disabled:opacity-50"
          title="Odśwież Dane"
          aria-label="Odśwież Dane Statystyczne"
        >
          <motion.div 
            animate={loading ? { rotate: 360 } : {}} 
            transition={loading ? { repeat: Infinity, duration: 1, ease: "linear" } : {}}
            whileTap={!loading ? { scale: 0.9 } : {}}
          >
            <RefreshCw className={`w-5 h-5 ${loading ? 'text-cyan-400' : ''}`} />
          </motion.div>
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
        {/* Author Progress */}
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="glass-card p-6 rounded-3xl border-cyan-500/10 space-y-6"
        >
          <h3 className="text-sm font-bold font-display uppercase tracking-widest text-cyan-500 flex items-center gap-2 mb-4">
            <User className="w-4 h-4" />
            Indeks Autorów
          </h3>
          <div className="space-y-4 max-h-[300px] overflow-y-auto pr-2 custom-scrollbar">
            {stats.authorStats.map((author) => (
              <AuthorProgressItem key={author.name} author={author} />
            ))}
          </div>
        </motion.div>

        {/* Award Progress */}
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="glass-card p-6 rounded-3xl border-purple-500/10 space-y-6"
        >
          <h3 className="text-sm font-bold font-display uppercase tracking-widest text-purple-500 flex items-center gap-2 mb-4">
            <Award className="w-4 h-4" />
            Progres Archiwum Nagród
          </h3>
          <div className="space-y-6">
            <ProgressBar 
              current={stats.awardBooksStats.read}
              total={stats.awardBooksStats.total}
              label="Polskie wydania z listy nagród"
              icon={Book}
              color="purple"
            />
            <ProgressBar 
              current={stats.allAwardsStats.read}
              total={stats.allAwardsStats.total}
              label="Książki mające Wszystkie Nagrody"
              icon={Award}
              color="emerald"
            />
            
            <AwardCoverageGrid coverage={stats.awardCoverage} />
          </div>
        </motion.div>

        {/* Aggregate Availability */}
        <AvailabilityCard stats={stats.availabilityStats} />

        {/* Publishers / Series / Cycles */}
        <PublishingCard publishers={stats.publisherStats} series={stats.seriesStats} cycles={stats.cycleStats} />

        {/* Decade histogram — full width */}
        <div className="md:col-span-2">
          <DecadeHistogram decades={stats.decadeStats} />
        </div>

        {/* Yearly Progress */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="glass-card p-6 rounded-3xl border-orange-500/10 space-y-6"
        >
          <h3 className="text-sm font-bold font-display uppercase tracking-widest text-orange-500 flex items-center gap-2 mb-4">
            <Calendar className="w-4 h-4" />
            Chronologia Przeczytanych
          </h3>
          <div className="space-y-4 max-h-[400px] overflow-y-auto pr-2 custom-scrollbar">
            {stats.yearlyStats.map((year) => (
              <YearlyProgressItem key={year.year} year={year} />
            ))}
          </div>
        </motion.div>

        {/* Owned but Unread */}
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.25 }}
          className="glass-card p-6 rounded-3xl border-emerald-500/10 space-y-6"
        >
          <h3 className="text-sm font-bold font-display uppercase tracking-widest text-emerald-500 flex items-center gap-2 mb-4">
            <Package className="w-4 h-4" />
            Zasoby Oczekujące (Posiadane)
          </h3>
          <div className="space-y-3 max-h-[300px] overflow-y-auto pr-2 custom-scrollbar">
            {stats.ownedUnread.length === 0 ? (
              <p className="text-slate-400 text-sm italic text-center py-8">Wszystkie posiadane zasoby zostały przyswojone.</p>
            ) : (
              stats.ownedUnread.map((book, idx) => (
                <OwnedUnreadItem
                  key={idx}
                  book={book}
                  marking={markingId === book.id}
                  disabled={markingId !== null}
                  onMarkAsRead={markAsRead}
                />
              ))
            )}
          </div>
        </motion.div>

        {/* Library Progress */}
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
          className="glass-card p-6 rounded-3xl border-blue-500/10 space-y-6"
        >
          <h3 className="text-sm font-bold font-display uppercase tracking-widest text-blue-500 flex items-center gap-2 mb-4">
            <Library className="w-4 h-4" />
            Książki dostępne w bibliotekach
          </h3>
          <div className="space-y-4 max-h-[400px] overflow-y-auto pr-2 custom-scrollbar">
            {stats.libraryStats.map((library) => (
              <LibraryProgressItem 
                key={library.id} 
                library={library} 
                onMarkAsRead={markAsRead}
                markingId={markingId}
              />
            ))}
          </div>
        </motion.div>

        {/* Identified in Libraries */}
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.35 }}
          className="glass-card p-6 rounded-3xl border-blue-500/10 space-y-6"
        >
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-bold font-display uppercase tracking-widest text-blue-400 flex items-center gap-2">
              <Search className="w-4 h-4" />
              Zidentyfikowane w bibliotekach
            </h3>
            
            <button
              onClick={() => checkAllLibraries(branches)}
              disabled={checkingLibrary !== null}
              className="px-4 py-2 bg-blue-500/20 hover:bg-blue-500/30 text-blue-300 rounded-xl border border-blue-500/30 text-xs font-bold uppercase tracking-widest transition-all disabled:opacity-50 flex items-center gap-2"
            >
              {checkingLibrary ? (
                <motion.div animate={{ rotate: 360 }} transition={{ repeat: Infinity, duration: 1, ease: "linear" }}>
                  <RefreshCw className="w-3 h-3" />
                </motion.div>
              ) : (
                <Search className="w-3 h-3" />
              )}
              Skanuj Wszystkie
            </button>
          </div>
          
          {libraryError && (
            <div className="p-3 bg-red-500/10 border border-red-500/20 rounded-xl text-xs text-red-400 font-bold mb-4">
              Błąd skanowania: {libraryError}
            </div>
          )}

          <div className="space-y-6 max-h-[500px] overflow-y-auto pr-2 custom-scrollbar">
            {branches.map((library) => (
              <IdentifiedLibraryItem 
                key={library.id}
                library={library}
                books={identifiedBooks[library.id] || []}
                onCheck={() => checkLibrary(library.id, library.code)}
                onStop={stopLibraryCheck}
                onMarkAsRead={markAsRead}
                markingId={markingId}
                markedIds={markedIds}
                isChecking={checkingLibrary === library.id}
                progress={checkingLibrary === library.id ? checkProgress : null}
              />
            ))}
          </div>
        </motion.div>
      </div>
    </div>
  );
};
