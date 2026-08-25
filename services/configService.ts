import { NotionAdapter } from "../notion.adapter";
import { AppConfig, mergeConfig, diffFromDefaults, parseStoredConfig } from "../src/configSchema";
import { createLogger } from "../logger";

const log = createLogger("Config");

/** Krótki cache efektywnej konfiguracji — rytuały czytają ją na starcie przebiegu. */
const CONFIG_CACHE_TTL_MS = 30 * 1000;

/** Twardy limit rozmiaru blobu w opisie kolumny (diff od defaultów jest zwykle < 1 KB). */
const MAX_BLOB_CHARS = 1900;

/**
 * Serwis konfiguracji: efektywna konfiguracja = defaulty z `configSchema` + diff
 * składowany w Notion (opis kolumny `AppConfig`). Odczyt jest odporny: uszkodzony
 * blob / brak kolumny / błąd Notion → defaulty (aplikacja nigdy nie pada od configu).
 */
export class ConfigService {
  private cached: { cfg: AppConfig; expiresAt: number } | null = null;

  constructor(private notion: NotionAdapter) {}

  /** Efektywna konfiguracja (defaulty + nadpisania). `force` pomija cache. */
  async getConfig(force = false): Promise<AppConfig> {
    if (!force && this.cached && this.cached.expiresAt > Date.now()) return this.cached.cfg;
    let cfg: AppConfig;
    try {
      const raw = await this.notion.getAppConfigRaw();
      cfg = mergeConfig(parseStoredConfig(raw));
    } catch (e: any) {
      log.warn("Nie udało się odczytać konfiguracji z Notion — używam defaultów", { error: e?.message });
      cfg = mergeConfig(undefined);
    }
    this.cached = { cfg, expiresAt: Date.now() + CONFIG_CACHE_TTL_MS };
    return cfg;
  }

  /**
   * Zapis: wejście przechodzi przez mergeConfig (clampy/typy), składujemy TYLKO diff
   * od defaultów. Zwraca efektywną konfigurację po zapisie.
   */
  async saveConfig(input: unknown): Promise<AppConfig> {
    const cfg = mergeConfig(input);
    const overrides = diffFromDefaults(cfg);
    const json = Object.keys(overrides).length > 0 ? JSON.stringify(overrides) : "";
    if (json.length > MAX_BLOB_CHARS) {
      throw new Error(`Konfiguracja po zserializowaniu ma ${json.length} znaków (limit ${MAX_BLOB_CHARS}). Zmniejsz liczbę nadpisań (np. wpisów User-Agent).`);
    }
    await this.notion.saveAppConfigRaw(json);
    this.cached = { cfg, expiresAt: Date.now() + CONFIG_CACHE_TTL_MS };
    log.info("Zapisano konfigurację", { overrideSections: Object.keys(overrides), chars: json.length });
    return cfg;
  }
}
