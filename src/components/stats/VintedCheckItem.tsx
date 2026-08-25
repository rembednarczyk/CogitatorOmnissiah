import React from "react";
import { VintedResult, VintedSearchAttempt } from "../../hooks/useVintedCheck";
import { useVintedResolveSellers } from "../../hooks/useVintedResolveSellers";
import { useVintedStored } from "../../hooks/useVintedStored";
import { VintedScanControls, RESUME_HOURS } from "./vinted/VintedScanControls";
import { VintedScanProgress } from "./vinted/VintedScanProgress";
import { VintedDebugLog } from "./vinted/VintedDebugLog";
import { VintedResolveStatus } from "./vinted/VintedResolveStatus";
import { VintedBundleList } from "./vinted/VintedBundleList";
import { VintedBookResultList } from "./vinted/VintedBookResultList";

interface VintedCheckItemProps {
  results: VintedResult[];
  searchAttempts: VintedSearchAttempt[];
  onCheck: (opts?: { skipScannedWithinHours?: number }) => void;
  onStop: () => void;
  isChecking: boolean;
  progress: any;
}

export const VintedCheckItem: React.FC<VintedCheckItemProps> = ({ results, searchAttempts, onCheck, onStop, isChecking, progress }) => {
  const [showLogs, setShowLogs] = React.useState(false);
  // Wznawianie: domyślnie pomijamy książki skanowane < RESUME_HOURS h (bieżąca partia),
  // resztę skanujemy od najstarszych — kontynuacja przerwanego przebiegu, nie od zera.
  const [resumeScan, setResumeScan] = React.useState(true);
  const { isResolving, resolveProgress, resolveResult, resolveError, runResolve, stopResolve } = useVintedResolveSellers();
  const { stored, isLoadingStored, storedError, loadStored, clearStored } = useVintedStored();

  // Źródło danych: baza (jeśli wczytana) lub bieżący skan. Kafelki i paczki renderują to samo UI.
  const usingStored = !!stored && stored.results.length > 0;
  const displayResults = usingStored ? stored!.results : results;
  // Sprzedawcy (do paczek) pochodzą wyłącznie z bazy — live scan pokazuje same kafelki.
  const displaySellers = usingStored ? stored!.sellersByUrl : {};

  const onScanToggle = () => {
    if (isChecking) { onStop(); return; }
    // Wyjdź z widoku bazy, żeby świeże wyniki skanu były widoczne (nie pinowane do stored).
    clearStored();
    onCheck(resumeScan ? { skipScannedWithinHours: RESUME_HOURS } : undefined);
  };
  const onResolveToggle = () => { if (isResolving) { stopResolve(); return; } clearStored(); runResolve(); };

  return (
    <div className="space-y-8">
      <VintedScanControls
        isChecking={isChecking} isResolving={isResolving} isLoadingStored={isLoadingStored}
        usingStored={usingStored} hasAttempts={searchAttempts.length > 0}
        resumeScan={resumeScan} setResumeScan={setResumeScan}
        showLogs={showLogs} setShowLogs={setShowLogs}
        onScanToggle={onScanToggle} onResolveToggle={onResolveToggle}
        onLoadStored={loadStored} onClearStored={clearStored}
      />

      {isChecking && <VintedScanProgress progress={progress} />}

      <VintedDebugLog searchAttempts={searchAttempts} show={showLogs} />

      <VintedResolveStatus
        isResolving={isResolving} resolveProgress={resolveProgress} resolveError={resolveError} resolveResult={resolveResult}
        storedError={storedError} stored={stored} isLoadingStored={isLoadingStored}
        usingStored={usingStored} displayCount={displayResults.length}
      />

      <VintedBundleList results={displayResults} sellers={displaySellers} usingStored={usingStored} />

      {displayResults.length > 0 && <VintedBookResultList results={displayResults} />}

      {displayResults.length === 0 && !isChecking && !isLoadingStored && !stored && (
        <p className="text-xs text-slate-500 italic text-center py-4">Brak wyników z Vinted. Uruchom skanowanie albo wczytaj z bazy.</p>
      )}
    </div>
  );
};
