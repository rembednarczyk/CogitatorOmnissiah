import { useCallback, useEffect, useState } from "react";
import { AppConfig, DEFAULT_CONFIG, mergeConfig } from "../configSchema";

/**
 * Front-end application configuration.
 *
 * - `useEffectiveConfig` — for CONSUMERS (shelf, scanners, awards): a single fetch
 *   per session (module cache shared between hooks), `DEFAULT_CONFIG` until the
 *   response arrives, no error states (the consumer always gets a working config).
 * - `useAppConfig` — for the PANEL (Configuration tab): fresh fetch, local edit,
 *   PUT save; after saving it invalidates the consumers' cache.
 */

let cachedConfig: AppConfig | null = null;
let inflight: Promise<AppConfig> | null = null;
const listeners = new Set<(cfg: AppConfig) => void>();

async function fetchConfig(force = false): Promise<AppConfig> {
  const res = await fetch(`/api/app-config${force ? "?force=1" : ""}`);
  if (!res.ok) throw new Error(`Błąd serwera: ${res.status}`);
  // mergeConfig = client-side safety belt (and clamp for old responses).
  return mergeConfig(await res.json());
}

function loadShared(): Promise<AppConfig> {
  if (cachedConfig) return Promise.resolve(cachedConfig);
  if (!inflight) {
    inflight = fetchConfig()
      .then((cfg) => {
        cachedConfig = cfg;
        listeners.forEach((l) => l(cfg));
        return cfg;
      })
      .catch(() => DEFAULT_CONFIG) // network/500 → defaults; not cached, the next mount tries again
      .finally(() => { inflight = null; });
  }
  return inflight;
}

/** After a save in the panel: swap the cache and notify mounted consumers. */
export function publishEffectiveConfig(cfg: AppConfig): void {
  cachedConfig = cfg;
  listeners.forEach((l) => l(cfg));
}

/**
 * Persists the stats card order (`ui.statsOrder`) without opening the panel.
 * Optimistically publishes the new order right away (smooth reorder), while the
 * write to Notion runs in the background — a network error does not revert the
 * layout for this session. Does not clobber other knobs: it takes the current
 * effective config and swaps only this field.
 */
export async function persistStatsOrder(order: string[]): Promise<void> {
  await loadShared();
  // If loading the config failed (`cachedConfig` empty, `loadShared` returned
  // DEFAULT_CONFIG), DON'T save — otherwise a PUT of defaults would wipe real knobs
  // (branches, settings) on the server. The reorder waits for a healthy session.
  if (!cachedConfig) return;
  const next: AppConfig = { ...cachedConfig, ui: { ...cachedConfig.ui, statsOrder: order } };
  publishEffectiveConfig(next);
  try {
    const res = await fetch("/api/app-config", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(next),
    });
    if (res.ok) publishEffectiveConfig(mergeConfig(await res.json()));
  } catch {
    /* the optimistic version stays for this session */
  }
}

/** Effective config for consumers — defaults until fetched, then live. */
export function useEffectiveConfig(): AppConfig {
  const [cfg, setCfg] = useState<AppConfig>(cachedConfig ?? DEFAULT_CONFIG);
  useEffect(() => {
    const listener = (c: AppConfig) => setCfg(c);
    listeners.add(listener);
    loadShared().then((c) => setCfg(c));
    return () => { listeners.delete(listener); };
  }, []);
  return cfg;
}

/** Configuration panel state: editable draft + load/save. */
export function useAppConfig() {
  const [draft, setDraft] = useState<AppConfig | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [savedAt, setSavedAt] = useState<number | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setDraft(await fetchConfig(true));
    } catch (e: any) {
      setError(e?.message || "Nie udało się pobrać konfiguracji.");
      setDraft(mergeConfig(undefined));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const save = useCallback(async () => {
    if (!draft) return;
    setSaving(true);
    setError(null);
    try {
      const res = await fetch("/api/app-config", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(draft),
      });
      const body = await res.json().catch(() => null);
      if (!res.ok) throw new Error(body?.error || `Błąd serwera: ${res.status}`);
      const effective = mergeConfig(body);
      setDraft(effective);
      publishEffectiveConfig(effective);
      setSavedAt(Date.now());
    } catch (e: any) {
      setError(e?.message || "Nie udało się zapisać konfiguracji.");
    } finally {
      setSaving(false);
    }
  }, [draft]);

  return { draft, setDraft, loading, saving, error, savedAt, load, save };
}
