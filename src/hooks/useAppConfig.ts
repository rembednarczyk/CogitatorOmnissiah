import { useCallback, useEffect, useState } from "react";
import { AppConfig, DEFAULT_CONFIG, mergeConfig } from "../configSchema";

/**
 * Konfiguracja aplikacji po stronie frontu.
 *
 * - `useEffectiveConfig` — dla KONSUMENTÓW (regał, skanery, nagrody): jedno pobranie
 *   na sesję (cache modułowy współdzielony między hookami), `DEFAULT_CONFIG` do czasu
 *   odpowiedzi, brak stanów błędu (konsument zawsze dostaje działającą konfigurację).
 * - `useAppConfig` — dla PANELU (zakładka Konfiguracja): świeże pobranie, edycja
 *   lokalna, zapis PUT; po zapisie unieważnia cache konsumentów.
 */

let cachedConfig: AppConfig | null = null;
let inflight: Promise<AppConfig> | null = null;
const listeners = new Set<(cfg: AppConfig) => void>();

async function fetchConfig(force = false): Promise<AppConfig> {
  const res = await fetch(`/api/app-config${force ? "?force=1" : ""}`);
  if (!res.ok) throw new Error(`Błąd serwera: ${res.status}`);
  // mergeConfig = pas bezpieczeństwa po stronie klienta (i clamp starych odpowiedzi).
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
      .catch(() => DEFAULT_CONFIG) // sieć/500 → defaulty; nie zapisujemy do cache, kolejny mount spróbuje znów
      .finally(() => { inflight = null; });
  }
  return inflight;
}

/** Po zapisie w panelu: podmień cache i powiadom zamontowanych konsumentów. */
export function publishEffectiveConfig(cfg: AppConfig): void {
  cachedConfig = cfg;
  listeners.forEach((l) => l(cfg));
}

/** Efektywna konfiguracja dla konsumentów — defaulty do czasu pobrania, potem live. */
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

/** Stan panelu konfiguracji: draft do edycji + load/save. */
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
