import React from "react";
import { VintedResult, VintedSearchAttempt } from "../../hooks/useVintedCheck";
import { useVintedResolveSellers } from "../../hooks/useVintedResolveSellers";
import { useVintedStored } from "../../hooks/useVintedStored";
import { VintedScanControls } from "./vinted/VintedScanControls";
import { useEffectiveConfig } from "../../hooks/useAppConfig";
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
  // The „Kontynuuj" window from config (knob `vinted.resumeHours`).
  const resumeHours = useEffectiveConfig().vinted.resumeHours;
  // Resuming: by default we skip books scanned < RESUME_HOURS h ago (current batch),
  // and scan the rest from oldest first — continuation of an interrupted run, not from scratch.
  const [resumeScan, setResumeScan] = React.useState(true);
  const { isResolving, resolveProgress, resolveResult, resolveError, runResolve, stopResolve } = useVintedResolveSellers();
  const { stored, isLoadingStored, storedError, loadStored, clearStored } = useVintedStored();

  // Data source: the database (if loaded) or the current scan. Tiles and bundles render the same UI.
  const usingStored = !!stored && stored.results.length > 0;
  const displayResults = usingStored ? stored!.results : results;
  // Sellers (for bundles) come solely from the database — a live scan shows only tiles.
  const displaySellers = usingStored ? stored!.sellersByUrl : {};

  const onScanToggle = () => {
    if (isChecking) { onStop(); return; }
    // Exit the database view so fresh scan results are visible (not pinned to stored).
    clearStored();
    onCheck(resumeScan ? { skipScannedWithinHours: resumeHours } : undefined);
  };
  const onResolveToggle = () => { if (isResolving) { stopResolve(); return; } clearStored(); runResolve(); };

  return (
    <div className="space-y-8">
      <VintedScanControls
        resumeHours={resumeHours}
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
