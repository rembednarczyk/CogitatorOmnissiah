import React, { useState } from "react";
import { motion } from "motion/react";
import { BarChart3, RefreshCw, GripVertical, LayoutGrid, RotateCcw, Check } from "lucide-react";
import { useStats } from "../hooks/useStats";
import { useLibraryCheck } from "../hooks/useLibraryCheck";
import { useMarkAsRead } from "../hooks/useMarkAsRead";
import { AvailabilityCard } from "./stats/AvailabilityCard";
import { PublishingCard } from "./stats/PublishingCard";
import { DecadeHistogram } from "./stats/DecadeHistogram";
import { ReadingPaceCard } from "./stats/ReadingPaceCard";
import { MarketCard } from "./stats/MarketCard";
import { CyclesHarvestCard } from "./stats/CyclesHarvestCard";
import { KpiRow } from "./stats/KpiRow";
import { AuthorsCard } from "./stats/AuthorsCard";
import { AwardsProgressCard } from "./stats/AwardsProgressCard";
import { YearlyCard } from "./stats/YearlyCard";
import { OwnedUnreadCard } from "./stats/OwnedUnreadCard";
import { LibraryProgressCard } from "./stats/LibraryProgressCard";
import { IdentifiedLibraryCard } from "./stats/IdentifiedLibraryCard";
import { StatsMasonry, StatCard } from "./stats/StatsMasonry";
import { useCardReorder } from "../hooks/useCardReorder";
import { useEffectiveConfig } from "../hooks/useAppConfig";

export const StatsSection: React.FC = () => {
  // Library branches from config (fallback: defaults until fetched).
  const cfg = useEffectiveConfig();
  const branches = cfg.library.branches;
  const { stats, loading, error, fetchStats, addBookToLibrarySection } = useStats();
  const { identifiedBooks, checkingLibrary, checkProgress, libraryError, checkLibrary, checkAllLibraries, stopLibraryCheck } = useLibraryCheck();
  const { markingId, markedIds, markAsRead } = useMarkAsRead({ identifiedBooks, addBookToLibrarySection, fetchStats });

  // „Odśwież Dane" refreshes `stats` (fetchStats) AND cards with their own fetch
  // („Archiwum Cykli") — incrementing the signal forces them to refetch.
  const [refreshTick, setRefreshTick] = useState(0);
  const refreshAll = () => { fetchStats(); setRefreshTick((t) => t + 1); };

  // Card arranging (drag&drop reorder) state + persistence.
  const reorder = useCardReorder();

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
        <p className="text-cyan-400 font-display uppercase tracking-widest animate-pulse">Wczytywanie kolekcji...</p>
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

  // Card definitions in code order (= default). Each has a stable `id`, by which
  // we remember the user's layout (ui.statsOrder). Reordering doesn't change card content.
  const cards: StatCard[] = [
    { id: "authors", node: <AuthorsCard authors={stats.authorStats} /> },
    { id: "awards", node: <AwardsProgressCard awardBooks={stats.awardBooksStats} allAwards={stats.allAwardsStats} coverage={stats.awardCoverage} /> },
    { id: "availability", node: <AvailabilityCard stats={stats.availabilityStats} /> },
    { id: "market", node: <MarketCard market={stats.marketStats} /> },
    { id: "publishing", node: <PublishingCard publishers={stats.publisherStats} series={stats.seriesStats} cycles={stats.cycleStats} /> },
    { id: "cyclesHarvest", node: <CyclesHarvestCard refreshSignal={refreshTick} /> },
    { id: "decades", span2: true, node: <DecadeHistogram decades={stats.decadeStats} /> },
    { id: "readingPace", span2: true, node: <ReadingPaceCard reading={stats.readingStats} /> },
    { id: "yearly", node: <YearlyCard years={stats.yearlyStats} /> },
    { id: "ownedUnread", node: <OwnedUnreadCard books={stats.ownedUnread} markingId={markingId} onMarkAsRead={markAsRead} /> },
    { id: "library", node: <LibraryProgressCard libraries={stats.libraryStats} onMarkAsRead={markAsRead} markingId={markingId} /> },
    { id: "identified", node: <IdentifiedLibraryCard branches={branches} identifiedBooks={identifiedBooks} onCheck={checkLibrary} onCheckAll={() => checkAllLibraries(branches)} onStop={stopLibraryCheck} checkingLibrary={checkingLibrary} checkProgress={checkProgress} libraryError={libraryError} onMarkAsRead={markAsRead} markingId={markingId} markedIds={markedIds} /> },
  ];


  return (
    <div className="space-y-8">
      <div className="flex items-center gap-6">
        <div className="h-px flex-1 bg-gradient-to-r from-transparent via-cyan-500/20 to-transparent"></div>
        <div className="flex items-center gap-4">
          <BarChart3 className="w-6 h-6 text-cyan-400" />
          <h2 className="text-xl font-bold font-display uppercase tracking-[0.4em] text-cyan-100/90 whitespace-nowrap">
            Analiza Zasobów Wiedzy
          </h2>
        </div>
        <div className="h-px flex-1 bg-gradient-to-r from-transparent via-cyan-500/20 to-transparent"></div>

        {reorder.arranging && (
          <button
            onClick={reorder.reset}
            className="p-2 rounded-lg text-slate-500 hover:text-amber-300 hover:bg-slate-900 transition-colors"
            title="Przywróć domyślną kolejność kart"
            aria-label="Przywróć domyślną kolejność kart"
          >
            <RotateCcw className="w-5 h-5" />
          </button>
        )}
        <button
          onClick={reorder.toggle}
          className={`p-2 rounded-lg transition-colors border ${reorder.arranging ? "bg-amber-500/15 text-amber-300 border-amber-500/40" : "border-transparent text-slate-500 hover:text-amber-400 hover:bg-slate-900"}`}
          title={reorder.arranging ? "Zakończ układanie kart" : "Ułóż karty (przeciągnij i upuść)"}
          aria-label="Przełącz tryb układania kart"
        >
          {reorder.arranging ? <Check className="w-5 h-5" /> : <LayoutGrid className="w-5 h-5" />}
        </button>

        <button
          onClick={refreshAll}
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

      {/* „Twoja kolekcja" — stały rząd KPI (nad kartami; nie wchodzi w masonry). */}
      <KpiRow stats={stats} />

      {reorder.arranging && (
        <div className="flex items-center justify-center gap-2 text-[11px] text-amber-300/80 uppercase tracking-widest font-bold">
          <GripVertical className="w-3.5 h-3.5" />
          Przeciągnij karty, aby ustalić kolejność — zapis jest automatyczny
        </div>
      )}

      <StatsMasonry cards={cards} savedOrder={cfg.ui.statsOrder} reorder={reorder} />
    </div>
  );
};
