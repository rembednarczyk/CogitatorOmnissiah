import { useState } from "react";
import { useSync } from "./useSync";
import { PREDEFINED_AWARDS, SYNC_ALL_AWARD } from "../constants";
import { useEffectiveConfig } from "./useAppConfig";

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

  // Lista nagród z konfiguracji (+ pseudo-opcja pełnej synchronizacji);
  // PREDEFINED_AWARDS służy tylko jako stan początkowy do czasu pobrania.
  const cfg = useEffectiveConfig();
  const awardOptions = [...cfg.sync.awards, SYNC_ALL_AWARD];

  const sync = useSync("/api/sync", "/api/sync/stop", {
    awardName: PREDEFINED_AWARDS[0].name,
    pageTitle: PREDEFINED_AWARDS[0].title,
    color: "cyan"
  });
  const publisherSync = useSync("/api/sync-publisher", "/api/sync-publisher/stop", { color: "rose" });
  const seriesSync = useSync("/api/sync-series", "/api/sync-series/stop", { color: "indigo" });
  const cyclesSync = useSync("/api/sync-cycles", "/api/sync-cycles/stop", { color: "blue" });
  const cyclesHarvestSync = useSync("/api/sync-cycles-harvest", "/api/sync-cycles-harvest/stop", { color: "amber" });
  const lpSync = useSync("/api/sync-lp", "/api/sync-lp/stop", { color: "purple" });
  const integritySync = useSync("/api/sync-integrity", "/api/sync-integrity/stop", { color: "cyan" });
  const duplicatesSync = useSync("/api/sync-duplicates", "/api/sync-duplicates/stop", { color: "orange" });
  const purifySync = useSync("/api/sync-purify", "/api/sync-purify/stop", { color: "amber" });
  const schemaSync = useSync("/api/sync-schema", "/api/sync-schema/stop", { color: "emerald" });

  const syncs = [sync, publisherSync, seriesSync, cyclesSync, cyclesHarvestSync, lpSync, duplicatesSync, purifySync, schemaSync, integritySync];
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

  // Przyjmuje samą NAZWĘ nagrody (nie zdarzenie DOM) — manager pozostaje
  // niezależny od prezentacji (parsowanie <select> zostaje w komponencie).
  const handleAwardChange = (selectedName: string) => {
    const predefined = awardOptions.find(a => a.name === selectedName);

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
  const handleCyclesHarvest = () => handleSyncAction(cyclesHarvestSync);
  const handleSyncLp = () => handleSyncAction(lpSync);

  const handleSync = () => {
    const isSyncAll = sync.state.awardName === "Wszystkie Nagrody";
    handleSyncAction(sync, {
      awardName: sync.state.awardName,
      pageTitle: sync.state.pageTitle,
      syncAll: isSyncAll
    });
  };

  // „Wielki Rytuał" — sekwencja kroków opisana danymi (nie 7× copy-paste).
  // Kroki `abortOnFail` przerywają całość przy błędzie i porzucają wyniki; ostatni
  // (Lp) tylko dopisuje wynik, jeśli jest, i zawsze domyka podsumowanie.
  const FULL_SYNC_STEPS: { sync: any; name: string; color: string; label: string; params?: any; abortOnFail: boolean }[] = [
    { sync: schemaSync, name: "Schemat", color: "emerald", label: "Krok 1/7: Rytuał Inicjacji Schematu...", abortOnFail: true },
    { sync: purifySync, name: "Puryfikacja", color: "amber", label: "Krok 2/7: Rytuał Puryfikacji...", abortOnFail: true },
    { sync, name: "Nagrody", color: "cyan", label: "Krok 3/7: Synchronizacja Nagród...", params: { awardName: "Wszystkie Nagrody", syncAll: true }, abortOnFail: true },
    { sync: cyclesSync, name: "Cykle", color: "blue", label: "Krok 4/7: Rytuał Oznaczania Cykli...", abortOnFail: true },
    { sync: publisherSync, name: "Wydawcy", color: "rose", label: "Krok 5/7: Rytuał Wydania...", abortOnFail: true },
    { sync: seriesSync, name: "Serie", color: "indigo", label: "Krok 6/7: Rytuał Seryjny...", abortOnFail: true },
    { sync: lpSync, name: "Lubimy Czytać", color: "purple", label: "Krok 7/7: Rytuał Rekonstrukcji Liczb...", abortOnFail: false },
  ];

  const handleFullSync = async () => {
    setFullSyncResults(null);
    const results: any[] = [];

    for (const step of FULL_SYNC_STEPS) {
      clearOthers(step.sync);
      const res = await step.sync.startSync(step.params ?? {}, undefined, step.label);
      if (step.abortOnFail) {
        if (!res || res.success === false) return; // przerwij i porzuć częściowe wyniki
        results.push({ name: step.name, result: res, color: step.color });
      } else if (res) {
        results.push({ name: step.name, result: res, color: step.color });
      }
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
    sync, publisherSync, seriesSync, cyclesSync, cyclesHarvestSync, lpSync, integritySync, duplicatesSync, purifySync, schemaSync,
    // Lista nagród z konfiguracji (dropdown w SyncAwards)
    awardOptions,
    // Stan zbiorczy
    syncs, anyError, isAnySyncLoading,
    fullSyncResults, clearFullSyncResults: () => setFullSyncResults(null),
    // Akcje
    handleAwardChange, handleSync, handleFullSync, handleResetSync,
    handleSyncSchema, handleSyncPurify, handleSyncPublisher, handleSyncSeries,
    handleCyclesSync, handleCyclesHarvest, handleSyncLp, handleSyncDuplicates,
  };
}
