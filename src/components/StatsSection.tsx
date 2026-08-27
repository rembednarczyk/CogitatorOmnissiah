import React, { useState, useEffect } from "react";
import { motion } from "motion/react";
import { BarChart3, RefreshCw, GripVertical, LayoutGrid, RotateCcw, Check } from "lucide-react";
import { useStats } from "../hooks/useStats";
import { useLibraryCheck } from "../hooks/useLibraryCheck";
import { useMarkAsRead } from "../hooks/useMarkAsRead";
import { AvailabilityCard } from "./stats/AvailabilityCard";
import { PublishingCard } from "./stats/PublishingCard";
import { DecadeHistogram } from "./stats/DecadeHistogram";
import { MarketCard } from "./stats/MarketCard";
import { CyclesHarvestCard } from "./stats/CyclesHarvestCard";
import { KpiRow } from "./stats/KpiRow";
import { AuthorsCard } from "./stats/AuthorsCard";
import { AwardsProgressCard } from "./stats/AwardsProgressCard";
import { YearlyCard } from "./stats/YearlyCard";
import { OwnedUnreadCard } from "./stats/OwnedUnreadCard";
import { LibraryProgressCard } from "./stats/LibraryProgressCard";
import { IdentifiedLibraryCard } from "./stats/IdentifiedLibraryCard";
import { useEffectiveConfig, persistStatsOrder } from "../hooks/useAppConfig";
import { orderByIds, moveId, distributeColumns } from "../utils/statsLayout";

interface StatCard {
  id: string;
  /** Full-width grid card (md:col-span-2). */
  span2?: boolean;
  node: React.ReactNode;
}

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

  // Card arranging mode (drag&drop) + current drag state.
  const [arranging, setArranging] = useState(false);
  const [dragId, setDragId] = useState<string | null>(null);
  const [overId, setOverId] = useState<string | null>(null);

  // Masonry column count depends on the md breakpoint (768px) — round-robin keeps
  // reading „row by row", so the columns must match what's visible.
  const [cols, setCols] = useState(2);
  useEffect(() => {
    const mq = window.matchMedia("(min-width: 768px)");
    const apply = () => setCols(mq.matches ? 2 : 1);
    apply();
    mq.addEventListener("change", apply);
    return () => mq.removeEventListener("change", apply);
  }, []);

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
    { id: "yearly", node: <YearlyCard years={stats.yearlyStats} /> },
    { id: "ownedUnread", node: <OwnedUnreadCard books={stats.ownedUnread} markingId={markingId} onMarkAsRead={markAsRead} /> },
    { id: "library", node: <LibraryProgressCard libraries={stats.libraryStats} onMarkAsRead={markAsRead} markingId={markingId} /> },
    { id: "identified", node: <IdentifiedLibraryCard branches={branches} identifiedBooks={identifiedBooks} onCheck={checkLibrary} onCheckAll={() => checkAllLibraries(branches)} onStop={stopLibraryCheck} checkingLibrary={checkingLibrary} checkProgress={checkProgress} libraryError={libraryError} onMarkAsRead={markAsRead} markingId={markingId} markedIds={markedIds} /> },
  ];

  // Effective order (user's save + new cards at the end) and lookup by id.
  const order = orderByIds(cards.map((c) => c.id), cfg.ui.statsOrder);
  const byId = new Map(cards.map((c) => [c.id, c]));
  const ordered = order.map((id) => byId.get(id)).filter((c): c is StatCard => Boolean(c));

  const commitReorder = (target: string) => {
    if (!dragId || dragId === target) return;
    persistStatsOrder(moveId(order, dragId, target));
  };
  const exitArrange = () => { setArranging(false); setDragId(null); setOverId(null); };

  // A single card with the DnD wrapper + arranging-mode overlays (reusable in round-robin
  // blocks and in full-width cards).
  const renderCard = (card: StatCard) => {
    const dragging = dragId === card.id;
    const isOver = arranging && overId === card.id && !!dragId && dragId !== card.id;
    return (
      <div
        key={card.id}
        className={`relative ${arranging ? "cursor-move select-none" : ""} ${dragging ? "opacity-40" : ""}`}
        draggable={arranging}
        onDragStart={(e) => {
          if (!arranging) return;
          setDragId(card.id);
          e.dataTransfer.effectAllowed = "move";
          try { e.dataTransfer.setData("text/plain", card.id); } catch { /* Safari */ }
        }}
        onDragEnter={() => { if (arranging) setOverId(card.id); }}
        onDragOver={(e) => { if (arranging) e.preventDefault(); }}
        onDrop={(e) => { if (arranging) { e.preventDefault(); commitReorder(card.id); } }}
        onDragEnd={() => { setDragId(null); setOverId(null); }}
      >
        <div className={arranging ? "pointer-events-none" : ""}>{card.node}</div>
        {arranging && (
          <div className={`absolute inset-0 rounded-3xl border-2 border-dashed pointer-events-none transition-colors ${isOver ? "border-cyan-400/70 bg-cyan-500/5" : "border-amber-500/40"}`} />
        )}
        {arranging && !dragging && (
          <div className="absolute top-3 right-3 flex items-center gap-1 px-2 py-1 rounded-lg bg-slate-950/85 border border-amber-500/30 text-amber-300 text-[9px] font-bold uppercase tracking-widest pointer-events-none">
            <GripVertical className="w-3 h-3" /> przeciągnij
          </div>
        )}
      </div>
    );
  };

  // Segmentation: full-width cards (span2) break the round-robin block and render
  // at full width; the rest go into columns (i % cols) with independent packing.
  type Segment = { kind: "full"; card: StatCard } | { kind: "block"; cards: StatCard[] };
  const segments: Segment[] = [];
  let run: StatCard[] = [];
  for (const c of ordered) {
    if (c.span2) {
      if (run.length) { segments.push({ kind: "block", cards: run }); run = []; }
      segments.push({ kind: "full", card: c });
    } else {
      run.push(c);
    }
  }
  if (run.length) segments.push({ kind: "block", cards: run });

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

        {arranging && (
          <button
            onClick={() => persistStatsOrder([])}
            className="p-2 rounded-lg text-slate-500 hover:text-amber-300 hover:bg-slate-900 transition-colors"
            title="Przywróć domyślną kolejność kart"
            aria-label="Przywróć domyślną kolejność kart"
          >
            <RotateCcw className="w-5 h-5" />
          </button>
        )}
        <button
          onClick={() => (arranging ? exitArrange() : setArranging(true))}
          className={`p-2 rounded-lg transition-colors border ${arranging ? "bg-amber-500/15 text-amber-300 border-amber-500/40" : "border-transparent text-slate-500 hover:text-cyan-400 hover:bg-slate-900"}`}
          title={arranging ? "Zakończ układanie kart" : "Ułóż karty (przeciągnij i upuść)"}
          aria-label="Przełącz tryb układania kart"
        >
          {arranging ? <Check className="w-5 h-5" /> : <LayoutGrid className="w-5 h-5" />}
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

      {arranging && (
        <div className="flex items-center justify-center gap-2 text-[11px] text-amber-300/80 uppercase tracking-widest font-bold">
          <GripVertical className="w-3.5 h-3.5" />
          Przeciągnij karty, aby ustalić kolejność — zapis jest automatyczny
        </div>
      )}

      {/* Masonry „row by row": cards laid out round-robin (i % cols) across separate
          columns, each packing independently (no height coupling = no gaps),
          while reading left→right/top→bottom stays 0,1,2,3,... A full-width card
          (the decade histogram) breaks the block and takes the whole width. */}
      <div className="space-y-8">
        {segments.map((seg, si) =>
          seg.kind === "full" ? (
            <div key={`full-${si}`}>{renderCard(seg.card)}</div>
          ) : (
            <div key={`block-${si}`} className="flex gap-8">
              {distributeColumns(seg.cards, cols).map((col, ci) => (
                <div key={ci} className="flex-1 min-w-0 flex flex-col gap-8">
                  {col.map((card) => renderCard(card))}
                </div>
              ))}
            </div>
          )
        )}
      </div>
    </div>
  );
};
