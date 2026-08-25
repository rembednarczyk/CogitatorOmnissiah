import React from "react";
import { AnimatePresence } from "motion/react";
import { Cog } from "lucide-react";
import { useConfig } from "../hooks/useConfig";
import { useSyncManager } from "../hooks/useSyncManager";
import { StatusSection } from "./StatusSection";
import { SyncAwards } from "./SyncAwards";
import { OtherToolsCard } from "./OtherToolsCard";
import { ProgressAndResults } from "./ProgressAndResults";
import { SyncSummaryResult } from "./SyncSummaryResult";
import { SchemaSection } from "./SchemaSection";
import { SanctityDebugger } from "./SanctityDebugger";
import { formatETA } from "../utils/time";
import { IntegrityCheckResult } from "../types";

/**
 * Zawartość zakładki „Liturgie Synchronizacji" — rytuały + ich wyniki + schemat.
 * `useSyncManager` żyje w `App` (jego `anyError` zasila globalną kartę błędu), więc
 * ten sam jego egzemplarz przychodzi propem `sm`; własny stan konfiguracji (schemat)
 * pobieramy lokalnie przez `useConfig`.
 */
export const LiturgySection: React.FC<{ sm: ReturnType<typeof useSyncManager> }> = ({ sm }) => {
  const { configStatus, schema, schemaLoading, schemaError, fetchSchema } = useConfig();
  const {
    sync, publisherSync, seriesSync, cyclesSync, cyclesHarvestSync, lpSync, integritySync, duplicatesSync, purifySync, schemaSync,
    syncs, isAnySyncLoading, fullSyncResults, clearFullSyncResults,
    handleAwardChange, handleSync, handleFullSync, handleResetSync,
    handleSyncSchema, handleSyncPurify, handleSyncPublisher, handleSyncSeries,
    handleCyclesSync, handleCyclesHarvest, handleSyncLp, handleSyncDuplicates,
  } = sm;

  return (
    <>
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

      <StatusSection configStatus={configStatus} />

      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
        <SyncAwards
          sync={sync}
          awardOptions={sm.awardOptions}
          integritySync={integritySync}
          handleAwardChange={handleAwardChange}
          handleSync={handleSync}
          handleFullSync={handleFullSync}
          isAnySyncLoading={isAnySyncLoading}
        />
        <OtherToolsCard
          schemaSync={schemaSync}
          purifySync={purifySync}
          publisherSync={publisherSync}
          seriesSync={seriesSync}
          cyclesSync={cyclesSync}
          cyclesHarvestSync={cyclesHarvestSync}
          duplicatesSync={duplicatesSync}
          lpSync={lpSync}
          handleSyncSchema={handleSyncSchema}
          handleSyncPurify={handleSyncPurify}
          handleSyncPublisher={handleSyncPublisher}
          handleSyncSeries={handleSyncSeries}
          handleCyclesSync={handleCyclesSync}
          handleCyclesHarvest={handleCyclesHarvest}
          handleSyncDuplicates={handleSyncDuplicates}
          handleSyncLp={handleSyncLp}
          handleResetSync={handleResetSync}
          isAnySyncLoading={isAnySyncLoading}
        />
      </div>

      <AnimatePresence>
        <ProgressAndResults syncs={syncs} formatETA={formatETA} />
      </AnimatePresence>

      <AnimatePresence>
        <SyncSummaryResult syncs={syncs} fullSyncResults={fullSyncResults} onClearFullResults={clearFullSyncResults} />
      </AnimatePresence>

      <SanctityDebugger result={integritySync.state.result as IntegrityCheckResult | null} />

      <SchemaSection
        schema={schema}
        schemaLoading={schemaLoading}
        schemaError={schemaError}
        configStatus={configStatus}
        fetchSchema={fetchSchema}
      />
    </>
  );
};
