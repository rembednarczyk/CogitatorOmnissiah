import { DEFAULT_CONFIG } from "./configSchema";

/**
 * Fallback constants DERIVED from DEFAULT_CONFIG (single source of truth in configSchema).
 * Live values come from the configuration (`useEffectiveConfig` → GET /api/app-config);
 * these lists serve as initial state before the response arrives.
 */

/** Pseudo-award for a full sync — a UI option, not a wiki page. */
export const SYNC_ALL_AWARD = { name: "Wszystkie Nagrody", title: "Wszystkie" };

export const PREDEFINED_AWARDS = [...DEFAULT_CONFIG.sync.awards, SYNC_ALL_AWARD];

export const LIBRARY_BRANCHES = DEFAULT_CONFIG.library.branches;
