import { DEFAULT_CONFIG } from "./configSchema";

/**
 * Stałe-fallbacki DERYWOWANE z DEFAULT_CONFIG (jedno źródło prawdy w configSchema).
 * Żywe wartości pochodzą z konfiguracji (`useEffectiveConfig` → GET /api/app-config);
 * te listy służą jako stan początkowy zanim odpowiedź dotrze.
 */

/** Pseudo-nagroda pełnej synchronizacji — opcja UI, nie strona wiki. */
export const SYNC_ALL_AWARD = { name: "Wszystkie Nagrody", title: "Wszystkie" };

export const PREDEFINED_AWARDS = [...DEFAULT_CONFIG.sync.awards, SYNC_ALL_AWARD];

export const LIBRARY_BRANCHES = DEFAULT_CONFIG.library.branches;
