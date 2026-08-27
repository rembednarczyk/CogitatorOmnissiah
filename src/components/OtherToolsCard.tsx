import React from "react";
import { Settings, Search, RefreshCw, AlertTriangle, Sparkles, Database, BookOpen, Layers, Barcode } from "lucide-react";
import { motion } from "motion/react";
import { useSync } from "../hooks/useSync";
import { RitualButton } from "./stats/RitualButton";
import { RitualColor } from "../theme/ritualColors";

interface OtherToolsCardProps {
  schemaSync: ReturnType<typeof useSync>;
  purifySync: ReturnType<typeof useSync>;
  publisherSync: ReturnType<typeof useSync>;
  seriesSync: ReturnType<typeof useSync>;
  cyclesSync: ReturnType<typeof useSync>;
  cyclesHarvestSync: ReturnType<typeof useSync>;
  isbnEnrichSync: ReturnType<typeof useSync>;
  duplicatesSync: ReturnType<typeof useSync>;
  lpSync: ReturnType<typeof useSync>;
  handleSyncSchema: () => void;
  handleSyncPurify: () => void;
  handleSyncPublisher: () => void;
  handleSyncSeries: () => void;
  handleCyclesSync: () => void;
  handleCyclesHarvest: () => void;
  handleIsbnEnrich: () => void;
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
  cyclesHarvestSync,
  isbnEnrichSync,
  duplicatesSync,
  lpSync,
  handleSyncSchema,
  handleSyncPurify,
  handleSyncPublisher,
  handleSyncSeries,
  handleCyclesSync,
  handleCyclesHarvest,
  handleIsbnEnrich,
  handleSyncDuplicates,
  handleSyncLp,
  handleResetSync,
  isAnySyncLoading
}) => {
  // All rituals in one idiom (`RitualButton` + central `ritualButtonTheme`).
  const rituals: { color: RitualColor; icon: typeof Database; title: string; subtitle: string; onClick: () => void; animate?: "spin" | "pulse" }[] = [
    { color: "emerald", icon: Database, title: "Inicjacja schematu", subtitle: "Weryfikacja i kreacja brakujących kolumn w bazie Notion", onClick: handleSyncSchema, animate: schemaSync.state.loading ? "pulse" : undefined },
    { color: "amber", icon: Sparkles, title: "Porządkowanie tytułów", subtitle: "Oczyszczanie tytułów z nadmiarowych znaków i formatowania", onClick: handleSyncPurify, animate: purifySync.state.loading ? "pulse" : undefined },
    { color: "purple", icon: RefreshCw, title: "Rekonstrukcja numeracji", subtitle: "Rekalkulacja i naprawa numeracji porządkowej rekordów", onClick: handleSyncLp, animate: lpSync.state.loading ? "spin" : undefined },
    { color: "blue", icon: RefreshCw, title: "Oznaczanie cykli", subtitle: "Automatyczne przypisywanie książek do cykli wydawniczych", onClick: handleCyclesSync, animate: cyclesSync.state.loading ? "spin" : undefined },
    { color: "amber", icon: Layers, title: "Zbieranie tomów cykli", subtitle: "Materializacja sąsiednich tomów cykli jako wiersze bazy (Kategoria: Tom cyklu) — oznaczalne i skanowane na Vinted", onClick: handleCyclesHarvest, animate: cyclesHarvestSync.state.loading ? "spin" : undefined },
    { color: "rose", icon: BookOpen, title: "Wydawcy", subtitle: "Eksploracja i aktualizacja danych o wydawcach z Encyklopedii", onClick: handleSyncPublisher, animate: publisherSync.state.loading ? "pulse" : undefined },
    { color: "indigo", icon: Layers, title: "Serie", subtitle: "Eksploracja i aktualizacja danych o seriach wydawniczych", onClick: handleSyncSeries, animate: seriesSync.state.loading ? "pulse" : undefined },
    { color: "emerald", icon: Barcode, title: "Nadawanie ISBN", subtitle: "Nadawanie kodów ISBN z Google Books — umożliwia skan kodu kreskowego w Katalogu", onClick: handleIsbnEnrich, animate: isbnEnrichSync.state.loading ? "pulse" : undefined },
    { color: "orange", icon: Search, title: "Wykrywanie duplikatów", subtitle: "Identyfikacja i oznaczanie potencjalnych duplikatów w bazie", onClick: handleSyncDuplicates, animate: duplicatesSync.state.loading ? "pulse" : undefined },
  ];
  return (
    <motion.div 
      initial={{ opacity: 0, x: 20 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ delay: 0.5 }}
      className="glass-card p-8 rounded-3xl flex flex-col h-full"
    >
      <h2 className="text-xl font-bold font-display flex items-center gap-3 mb-6 uppercase tracking-widest text-cyan-400">
        <Settings className="w-5 h-5" />
        Narzędzia
      </h2>
      
      <div className="grid grid-cols-1 gap-4 flex-1">
        {rituals.map((r) => (
          <RitualButton
            key={r.title}
            color={r.color} icon={r.icon} title={r.title} subtitle={r.subtitle}
            onClick={r.onClick} animate={r.animate} disabled={isAnySyncLoading}
          />
        ))}
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
          <p className="text-[10px] text-slate-400 mt-2 text-center italic">Użyj tylko jeśli proces utknął w martwym punkcie.</p>
        </div>
      )}
    </motion.div>
  );
};
