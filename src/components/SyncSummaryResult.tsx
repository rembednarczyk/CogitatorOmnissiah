import React from "react";
import { useSync } from "../hooks/useSync";
import { FullSyncSummary } from "./sync/FullSyncSummary";
import { SingleSyncSummary } from "./sync/SingleSyncSummary";

interface SyncSummaryResultProps {
  syncs: ReturnType<typeof useSync>[];
  fullSyncResults?: any[] | null;
  onClearFullResults?: () => void;
}

/** Rozdziela widok podsumowania: agregat „Wielkiego Rytuału" vs pojedynczy rytuał. */
export const SyncSummaryResult: React.FC<SyncSummaryResultProps> = ({ syncs, fullSyncResults, onClearFullResults }) => {
  const activeSync = syncs.find(s => s.state.result && s.endpoint !== "/api/sync-integrity");
  if (!activeSync && !fullSyncResults) return null;

  const resetAll = () => syncs.forEach(s => s.setState(prev => ({ ...prev, result: null })));

  if (fullSyncResults && fullSyncResults.length > 0) {
    return <FullSyncSummary results={fullSyncResults} onClose={() => { resetAll(); onClearFullResults?.(); }} />;
  }

  if (!activeSync) return null;
  return <SingleSyncSummary sync={activeSync} onClose={resetAll} />;
};
