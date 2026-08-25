import React, { useState, useEffect } from "react";
import { motion } from "motion/react";
import { Book, BarChart3, Award, User, Calendar, Package, RefreshCw, Library, Search, GripVertical, LayoutGrid, RotateCcw, Check } from "lucide-react";
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
import { MarketCard } from "./stats/MarketCard";
import { CyclesHarvestCard } from "./stats/CyclesHarvestCard";
import { useEffectiveConfig, persistStatsOrder } from "../hooks/useAppConfig";
import { orderByIds, moveId, distributeColumns } from "../utils/statsLayout";

interface StatCard {
  id: string;
  /** Karta na pełną szerokość siatki (md:col-span-2). */
  span2?: boolean;
  node: React.ReactNode;
}

export const StatsSection: React.FC = () => {
  // Filie biblioteczne z konfiguracji (fallback: defaulty do czasu pobrania).
  const cfg = useEffectiveConfig();
  const branches = cfg.library.branches;
  const { stats, loading, error, fetchStats, addBookToLibrarySection } = useStats();
  const { identifiedBooks, checkingLibrary, checkProgress, libraryError, checkLibrary, checkAllLibraries, stopLibraryCheck } = useLibraryCheck();
  const { markingId, markedIds, markAsRead } = useMarkAsRead({ identifiedBooks, addBookToLibrarySection, fetchStats });

  // Tryb układania kart (drag&drop) + stan bieżącego przeciągania.
  const [arranging, setArranging] = useState(false);
  const [dragId, setDragId] = useState<string | null>(null);
  const [overId, setOverId] = useState<string | null>(null);

  // Liczba kolumn masonry zależna od breakpointu md (768px) — round-robin trzyma
  // czytanie „wiersz po wierszu", więc kolumny muszą odpowiadać temu, co widać.
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

  // Definicje kart w kolejności kodu (= domyślna). Każda ma stabilne `id`, po którym
  // zapamiętujemy układ użytkownika (ui.statsOrder). Reorder nie zmienia treści kart.
  const cards: StatCard[] = [
    {
      id: "authors",
      node: (
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="glass-card p-6 rounded-3xl border-cyan-500/10 space-y-6">
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
      ),
    },
    {
      id: "awards",
      node: (
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }} className="glass-card p-6 rounded-3xl border-purple-500/10 space-y-6">
          <h3 className="text-sm font-bold font-display uppercase tracking-widest text-purple-500 flex items-center gap-2 mb-4">
            <Award className="w-4 h-4" />
            Progres Archiwum Nagród
          </h3>
          <div className="space-y-6">
            <ProgressBar current={stats.awardBooksStats.read} total={stats.awardBooksStats.total} label="Polskie wydania z listy nagród" icon={Book} color="purple" />
            <ProgressBar current={stats.allAwardsStats.read} total={stats.allAwardsStats.total} label="Książki mające Wszystkie Nagrody" icon={Award} color="emerald" />
            <AwardCoverageGrid coverage={stats.awardCoverage} />
          </div>
        </motion.div>
      ),
    },
    { id: "availability", node: <AvailabilityCard stats={stats.availabilityStats} /> },
    { id: "market", node: <MarketCard market={stats.marketStats} /> },
    { id: "publishing", node: <PublishingCard publishers={stats.publisherStats} series={stats.seriesStats} cycles={stats.cycleStats} /> },
    { id: "cyclesHarvest", node: <CyclesHarvestCard /> },
    { id: "decades", span2: true, node: <DecadeHistogram decades={stats.decadeStats} /> },
    {
      id: "yearly",
      node: (
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }} className="glass-card p-6 rounded-3xl border-orange-500/10 space-y-6">
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
      ),
    },
    {
      id: "ownedUnread",
      node: (
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.25 }} className="glass-card p-6 rounded-3xl border-emerald-500/10 space-y-6">
          <h3 className="text-sm font-bold font-display uppercase tracking-widest text-emerald-500 flex items-center gap-2 mb-4">
            <Package className="w-4 h-4" />
            Zasoby Oczekujące (Posiadane)
          </h3>
          <div className="space-y-3 max-h-[300px] overflow-y-auto pr-2 custom-scrollbar">
            {stats.ownedUnread.length === 0 ? (
              <p className="text-slate-400 text-sm italic text-center py-8">Wszystkie posiadane zasoby zostały przyswojone.</p>
            ) : (
              stats.ownedUnread.map((book, idx) => (
                <OwnedUnreadItem key={idx} book={book} marking={markingId === book.id} disabled={markingId !== null} onMarkAsRead={markAsRead} />
              ))
            )}
          </div>
        </motion.div>
      ),
    },
    {
      id: "library",
      node: (
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }} className="glass-card p-6 rounded-3xl border-blue-500/10 space-y-6">
          <h3 className="text-sm font-bold font-display uppercase tracking-widest text-blue-500 flex items-center gap-2 mb-4">
            <Library className="w-4 h-4" />
            Książki dostępne w bibliotekach
          </h3>
          <div className="space-y-4 max-h-[400px] overflow-y-auto pr-2 custom-scrollbar">
            {stats.libraryStats.map((library) => (
              <LibraryProgressItem key={library.id} library={library} onMarkAsRead={markAsRead} markingId={markingId} />
            ))}
          </div>
        </motion.div>
      ),
    },
    {
      id: "identified",
      node: (
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.35 }} className="glass-card p-6 rounded-3xl border-blue-500/10 space-y-6">
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
      ),
    },
  ];

  // Kolejność efektywna (zapis użytkownika + nowe karty na końcu) i wyszukiwanie po id.
  const order = orderByIds(cards.map((c) => c.id), cfg.ui.statsOrder);
  const byId = new Map(cards.map((c) => [c.id, c]));
  const ordered = order.map((id) => byId.get(id)).filter((c): c is StatCard => Boolean(c));

  const commitReorder = (target: string) => {
    if (!dragId || dragId === target) return;
    persistStatsOrder(moveId(order, dragId, target));
  };
  const exitArrange = () => { setArranging(false); setDragId(null); setOverId(null); };

  // Jedna karta z opakowaniem DnD + nakładkami trybu układania (reużywalna w blokach
  // round-robin i w kartach pełnej szerokości).
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

  // Segmentacja: karty pełnej szerokości (span2) przerywają blok round-robin i renderują
  // się na całą szerokość; pozostałe idą w kolumny (i % cols) z niezależnym pakowaniem.
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

      {arranging && (
        <div className="flex items-center justify-center gap-2 text-[11px] text-amber-300/80 uppercase tracking-widest font-bold">
          <GripVertical className="w-3.5 h-3.5" />
          Przeciągnij karty, aby ustalić kolejność — zapis jest automatyczny
        </div>
      )}

      {/* Masonry „wiersz po wierszu": karty rozłożone round-robin (i % cols) na osobne
          kolumny, każda pakuje się niezależnie (brak sprzężenia wysokości = brak dziur),
          a odczyt lewo→prawo/góra→dół pozostaje 0,1,2,3,... Karta pełnej szerokości
          (histogram dekad) przerywa blok i zajmuje całą szerokość. */}
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
