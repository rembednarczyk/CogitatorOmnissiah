import { NotionAdapter } from "../notion.adapter";
import { AppConfig, mergeConfig, diffFromDefaults, parseStoredConfig } from "../src/configSchema";
import { createLogger } from "../logger";

const log = createLogger("Config");

/** Short cache of the effective config — rituals read it at the start of a run. */
const CONFIG_CACHE_TTL_MS = 30 * 1000;

/** Hard cap on the blob size in the column description (the diff from defaults is usually < 1 KB). */
const MAX_BLOB_CHARS = 1900;

/**
 * Config service: effective config = defaults from `configSchema` + diff
 * stored in Notion (description of the `AppConfig` column). Reads are resilient: a corrupt
 * blob / missing column / Notion error → defaults (the app never crashes on config).
 */
export class ConfigService {
  private cached: { cfg: AppConfig; expiresAt: number } | null = null;

  constructor(private notion: NotionAdapter) {}

  /** Effective config (defaults + overrides). `force` bypasses the cache. */
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
   * Save: input goes through mergeConfig (clamps/types), we store ONLY the diff
   * from defaults. Returns the effective config after the save.
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
