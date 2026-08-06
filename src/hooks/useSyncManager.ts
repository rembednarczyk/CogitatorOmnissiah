import React, { useState } from "react";
import { useSync } from "./useSync";
import { PREDEFINED_AWARDS } from "../constants";

/**
 * Orkiestracja wszystkich rytuałów synchronizacji po stronie frontendu.
 *
 * Trzyma dziewięć instancji `useSync` (po jednej na rytuał), wzajemne czyszczenie
 * stanu, sekwencyjny "Wielki Rytuał" (full sync) oraz wynik zbiorczy. Wyniesione
 * z `App.tsx`, żeby komponent został przy renderowaniu, a logika żyła w hooku
 * (zob. COGITATOR_GUIDELINES §2 "Logic Isolation").
 */
export function useSyncManager() {
  const [fullSyncResults, setFullSyncResults] = useState<any[] | null>(null);

  const sync = useSync("/api/sync", "/api/sync/stop", {
    awardName: PREDEFINED_AWARDS[0].name,
    pageTitle: PREDEFINED_AWARDS[0].title,
    color: "cyan"
  });
  const publisherSync = useSync("/api/sync-publisher", "/api/sync-publisher/stop", { color: "rose" });
  const seriesSync = useSync("/api/sync-series", "/api/sync-series/stop", { color: "indigo" });
  const cyclesSync = useSync("/api/sync-cycles", "/api/sync-cycles/stop", { color: "blue" });
  const lpSync = useSync("/api/sync-lp", "/api/sync-lp/stop", { color: "purple" });
  const integritySync = useSync("/api/sync-integrity", "/api/sync-integrity/stop", { color: "cyan" });
  const duplicatesSync = useSync("/api/sync-duplicates", "/api/sync-duplicates/stop", { color: "orange" });
  const purifySync = useSync("/api/sync-purify", "/api/sync-purify/stop", { color: "amber" });
  const schemaSync = useSync("/api/sync-schema", "/api/sync-schema/stop", { color: "emerald" });

  const syncs = [sync, publisherSync, seriesSync, cyclesSync, lpSync, duplicatesSync, purifySync, schemaSync, integritySync];
  const anyError = syncs.find(s => s.state.error);
  const isAnySyncLoading = syncs.some(s => s.state.loading);

  const clearOthers = (currentSync: any) => {
    syncs.forEach(s => {
      if (s !== currentSync) {
        s.reset();
      }
    });
  };

  const handleSyncAction = async (syncService: any, params: any = {}, statusMessage: string | null = null) => {
    setFullSyncResults(null);
    clearOthers(syncService);
    return await syncService.startSync(params, undefined, statusMessage);
  };

  const handleAwardChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const selectedName = e.target.value;
    const predefined = PREDEFINED_AWARDS.find(a => a.name === selectedName);

    sync.setState(prev => ({
      ...prev,
      awardName: selectedName,
      pageTitle: predefined ? predefined.title : (selectedName === "Wszystkie Nagrody" ? "" : prev.pageTitle)
    }));
  };

  const handleSyncSchema = () => handleSyncAction(schemaSync);
  const handleSyncPurify = () => handleSyncAction(purifySync);
  const handleSyncPublisher = () => handleSyncAction(publisherSync);
  const handleSyncSeries = () => handleSyncAction(seriesSync);
  const handleCyclesSync = () => handleSyncAction(cyclesSync);
  const handleSyncLp = () => handleSyncAction(lpSync);

  const handleSync = () => {
    const isSyncAll = sync.state.awardName === "Wszystkie Nagrody";
    handleSyncAction(sync, {
      awardName: sync.state.awardName,
      pageTitle: sync.state.pageTitle,
      syncAll: isSyncAll
    });
  };

  const handleFullSync = async () => {
    setFullSyncResults(null);
    const results: any[] = [];

    // 1. Schema Initiation
    clearOthers(schemaSync);
    const res1 = await schemaSync.startSync({}, undefined, "Krok 1/7: Rytuał Inicjacji Schematu...");
    if (!res1 || res1.success === false) return;
    results.push({ name: "Schemat", result: res1, color: "emerald" });

    // 2. Purification
    clearOthers(purifySync);
    const res2 = await purifySync.startSync({}, undefined, "Krok 2/7: Rytuał Puryfikacji...");
    if (!res2 || res2.success === false) return;
    results.push({ name: "Puryfikacja", result: res2, color: "amber" });

    // 3. Sync Awards (Wszystkie)
    clearOthers(sync);
    const res3 = await sync.startSync({
      awardName: "Wszystkie Nagrody",
      syncAll: true
    }, undefined, "Krok 3/7: Synchronizacja Nagród...");
    if (!res3 || res3.success === false) return;
    results.push({ name: "Nagrody", result: res3, color: "cyan" });

    // 4. Cycles Marking
    clearOthers(cyclesSync);
    const res4 = await cyclesSync.startSync({}, undefined, "Krok 4/7: Rytuał Oznaczania Cykli...");
    if (!res4 || res4.success === false) return;
    results.push({ name: "Cykle", result: res4, color: "blue" });

    // 5. Publisher Sync
    clearOthers(publisherSync);
    const res5 = await publisherSync.startSync({}, undefined, "Krok 5/7: Rytuał Wydania...");
    if (!res5 || res5.success === false) return;
    results.push({ name: "Wydawcy", result: res5, color: "rose" });

    // 6. Series Sync
    clearOthers(seriesSync);
    const res6 = await seriesSync.startSync({}, undefined, "Krok 6/7: Rytuał Seryjny...");
    if (!res6 || res6.success === false) return;
    results.push({ name: "Serie", result: res6, color: "indigo" });

    // 7. Numbers Reconstruction (Lp)
    clearOthers(lpSync);
    const res7 = await lpSync.startSync({}, undefined, "Krok 7/7: Rytuał Rekonstrukcji Liczb...");
    if (res7) {
      results.push({ name: "Lubimy Czytać", result: res7, color: "purple" });
    }

    setFullSyncResults(results);
  };

  const handleResetSync = async () => {
    try {
      await fetch("/api/sync/reset", { method: "POST" });
      syncs.forEach(s => s.reset());
    } catch (err) {
      console.error("Reset Error:", err);
    }
  };

  const handleSyncDuplicates = () => {
    clearOthers(duplicatesSync);
    duplicatesSync.startSync({}, (result) => {
      const duplicatesFormatted = result.duplicates.map((d: any) =>
        `${d.bookA} <-> ${d.bookB} (${d.reason})`
      );
      return {
        ...result,
        summary: { duplicates: duplicatesFormatted }
      };
    }, null);
  };

  return {
    // Instancje rytuałów (przekazywane do komponentów prezentacyjnych)
    sync, publisherSync, seriesSync, cyclesSync, lpSync, integritySync, duplicatesSync, purifySync, schemaSync,
    // Stan zbiorczy
    syncs, anyError, isAnySyncLoading,
    fullSyncResults, clearFullSyncResults: () => setFullSyncResults(null),
    // Akcje
    handleAwardChange, handleSync, handleFullSync, handleResetSync,
    handleSyncSchema, handleSyncPurify, handleSyncPublisher, handleSyncSeries,
    handleCyclesSync, handleSyncLp, handleSyncDuplicates,
  };
}
