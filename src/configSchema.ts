/**
 * App configuration schema (the knobs from the „Konfiguracja" tab).
 *
 * A SHARED frontend/backend module (pure TS, zero Node deps) — the frontend
 * takes its types and DEFAULT_CONFIG from here (form + reset), the backend merge/clamp/diff.
 * Storage principle: only the **diff from defaults** lands in Notion (the `AppConfig`
 * column description) — a small blob, and new knobs in the code get defaults without
 * a migration. The default values = exactly the app's existing behavior.
 */

export interface LibraryBranch {
  id: string;
  name: string;
  code: string;
  /** „Źródło" tag added after marking a book as available in this branch. */
  sourceTag: string;
}

export interface AwardPage {
  name: string;
  /** Page title in the Archiwum Encyklopedii Fantastyki. */
  title: string;
}

export interface AppConfig {
  vinted: {
    /** „Kontynuuj" window: skip books scanned in the last N h. */
    resumeHours: number;
    /** Minimum interval between requests (ms). */
    throttleMinMs: number;
    /** Random jitter added to the interval (ms). */
    throttleJitterMs: number;
    /** Timeout of a single HTTP request (ms). Do NOT shorten rashly — see backlog. */
    requestTimeoutMs: number;
    /** Number of withRetry attempts. */
    retryAttempts: number;
    /** Base backoff between attempts (ms). */
    retryBackoffMs: number;
    /** Vinted catalog category (2319 = fiction). */
    catalogId: number;
    /** Offer language filter (6440 = Polish). */
    languageId: number;
    /** Lower price threshold (cuts off junk offers). */
    priceFrom: number;
    currency: string;
    /** Catalog results sorting. */
    order: string;
    /** Cap on seller resolutions per run; 0 = no cap. */
    sellerResolveCap: number;
    /** „Źródło" tags that exclude a book from the Vinted scan. */
    excludedSources: string[];
    /** Warm up the session (GET the homepage → Cloudflare cookie) before the scan. */
    primeSession: boolean;
    /** Warm up via a headless browser (Playwright) — solves Cloudflare's JS challenge for a real
     *  `cf_clearance`. Needs Chromium on the backend; without it → falls back to the lightweight
     *  prime. Only takes effect when `primeSession` is on. */
    primeWithBrowser: boolean;
  };
  scraping: {
    /** User-Agent pool (rotated per request). Refresh every few months. */
    userAgents: string[];
  };
  library: {
    branches: LibraryBranch[];
    /** OPAC query concurrency. */
    concurrency: number;
    /** Tags excluding from the library scan (intentionally a separate list — without „Audioteka"). */
    excludedSources: string[];
  };
  sync: {
    /** Award pages on the wiki (Hugo/Nebula/Locus) — source for full sync and diagnostics. */
    awards: AwardPage[];
    /** Notion write concurrency (bookSync / cycles). */
    writeConcurrency: number;
    /** Author similarity threshold for duplicate detection (0–1). */
    dupAuthorThreshold: number;
    /** Title similarity threshold (PL and original) for duplicates (0–1). */
    dupTitleThreshold: number;
  };
  ui: {
    /** Number of shelf rows per page (Regał N/M). */
    shelfRowsPerPage: number;
    /** Precise drag&drop on the shelf (inserting into a slot within a decade). */
    preciseShelfDrop: boolean;
    /** Card order in „Analizie Zasobów" (section ids). Empty = default order from code. */
    statsOrder: string[];
  };
}

/** Deep partial of the config (shape of the overrides stored in Notion). */
export type ConfigOverrides = {
  [S in keyof AppConfig]?: Partial<AppConfig[S]>;
};

export const DEFAULT_CONFIG: AppConfig = {
  vinted: {
    resumeHours: 24,
    throttleMinMs: 3000,
    throttleJitterMs: 2000,
    requestTimeoutMs: 30000,
    retryAttempts: 3,
    retryBackoffMs: 4000,
    catalogId: 2319,
    languageId: 6440,
    priceFrom: 2,
    currency: "PLN",
    order: "price_low_to_high",
    sellerResolveCap: 0,
    excludedSources: ["Posiadam", "Przeczytane", "Audioteka", "Biblioteka", "Biblioteka 9"],
    primeSession: true,
    primeWithBrowser: false,
  },
  scraping: {
    userAgents: [
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/152.0.0.0 Safari/537.36',
      'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/151.0.0.0 Safari/537.36',
      'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/151.0.0.0 Safari/537.36',
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:154.0) Gecko/20100101 Firefox/154.0',
      'Mozilla/5.0 (Macintosh; Intel Mac OS X 10.15; rv:154.0) Gecko/20100101 Firefox/154.0',
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/151.0.0.0 Safari/537.36 Edg/151.0.0.0',
      'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/26.0 Safari/605.1.15',
    ],
  },
  library: {
    branches: [
      { id: "felin", name: "Biblioteka Felin", code: "48", sourceTag: "Biblioteka" },
      { id: "bronowice", name: "Biblioteka Bronowice", code: "7", sourceTag: "Biblioteka 9" },
    ],
    concurrency: 6,
    excludedSources: ["Przeczytane", "Biblioteka", "Biblioteka 9", "Posiadam"],
  },
  sync: {
    awards: [
      { name: "Nagroda Hugo", title: "Hugo nagroda powieść" },
      { name: "Nagroda Nebula", title: "Nebula nagroda najlepsza powieść" },
      { name: "Nagroda Locus", title: "Locus nagroda powieść" },
    ],
    writeConcurrency: 3,
    dupAuthorThreshold: 0.85,
    dupTitleThreshold: 0.9,
  },
  ui: {
    shelfRowsPerPage: 5,
    preciseShelfDrop: true,
    statsOrder: [],
  },
};

/* ==================== Normalization / clamps ==================== */

const clamp = (v: unknown, min: number, max: number, dflt: number): number => {
  const n = typeof v === "number" && isFinite(v) ? v : NaN;
  return isNaN(n) ? dflt : Math.min(max, Math.max(min, n));
};
const clampInt = (v: unknown, min: number, max: number, dflt: number): number =>
  Math.round(clamp(v, min, max, dflt));

const cleanBool = (v: unknown, dflt: boolean): boolean => (typeof v === "boolean" ? v : dflt);

const cleanString = (v: unknown, dflt: string, maxLen = 120): string => {
  const s = typeof v === "string" ? v.trim() : "";
  return s.length > 0 && s.length <= maxLen ? s : dflt;
};

const cleanStringList = (v: unknown, dflt: string[], maxItems = 30, maxLen = 400): string[] => {
  if (!Array.isArray(v)) return [...dflt];
  const out = v
    .filter((x): x is string => typeof x === "string")
    .map((x) => x.trim())
    .filter((x) => x.length > 0 && x.length <= maxLen)
    .slice(0, maxItems);
  return out.length > 0 ? out : [...dflt];
};

/** List of identifiers (e.g. card order) — empty allowed, dedup, truncation. */
const cleanIdList = (v: unknown, maxItems = 40, maxLen = 40): string[] => {
  if (!Array.isArray(v)) return [];
  const seen = new Set<string>();
  const out: string[] = [];
  for (const x of v) {
    if (typeof x !== "string") continue;
    const s = x.trim();
    if (s && s.length <= maxLen && !seen.has(s)) { seen.add(s); out.push(s); }
    if (out.length >= maxItems) break;
  }
  return out;
};

const cleanBranches = (v: unknown, dflt: LibraryBranch[]): LibraryBranch[] => {
  if (!Array.isArray(v)) return dflt.map((b) => ({ ...b }));
  const out: LibraryBranch[] = [];
  for (const raw of v.slice(0, 20)) {
    if (!raw || typeof raw !== "object") continue;
    const b = raw as Record<string, unknown>;
    const id = cleanString(b.id, "", 40);
    const name = cleanString(b.name, "", 80);
    const code = cleanString(b.code, "", 20);
    const sourceTag = cleanString(b.sourceTag, "", 60);
    if (id && name && code && sourceTag && !out.some((x) => x.id === id)) {
      out.push({ id, name, code, sourceTag });
    }
  }
  return out.length > 0 ? out : dflt.map((b) => ({ ...b }));
};

const cleanAwards = (v: unknown, dflt: AwardPage[]): AwardPage[] => {
  if (!Array.isArray(v)) return dflt.map((a) => ({ ...a }));
  const out: AwardPage[] = [];
  for (const raw of v.slice(0, 20)) {
    if (!raw || typeof raw !== "object") continue;
    const a = raw as Record<string, unknown>;
    const name = cleanString(a.name, "", 80);
    const title = cleanString(a.title, "", 120);
    if (name && title && !out.some((x) => x.name === name)) out.push({ name, title });
  }
  return out.length > 0 ? out : dflt.map((a) => ({ ...a }));
};

/**
 * Merges overrides with defaults and clamps every value to a safe range.
 * Unknown fields are ignored, bad types fall back to the default — the function NEVER
 * throws (a corrupted blob in Notion must not kill the app).
 */
export function mergeConfig(overrides?: unknown): AppConfig {
  const o = (overrides && typeof overrides === "object" ? overrides : {}) as ConfigOverrides;
  const d = DEFAULT_CONFIG;
  const v = o.vinted ?? {};
  const s = o.scraping ?? {};
  const l = o.library ?? {};
  const y = o.sync ?? {};
  const u = o.ui ?? {};
  return {
    vinted: {
      resumeHours: clampInt(v.resumeHours, 1, 8760, d.vinted.resumeHours),
      throttleMinMs: clampInt(v.throttleMinMs, 500, 60000, d.vinted.throttleMinMs),
      throttleJitterMs: clampInt(v.throttleJitterMs, 0, 60000, d.vinted.throttleJitterMs),
      requestTimeoutMs: clampInt(v.requestTimeoutMs, 5000, 120000, d.vinted.requestTimeoutMs),
      retryAttempts: clampInt(v.retryAttempts, 1, 6, d.vinted.retryAttempts),
      retryBackoffMs: clampInt(v.retryBackoffMs, 500, 60000, d.vinted.retryBackoffMs),
      catalogId: clampInt(v.catalogId, 1, 999999, d.vinted.catalogId),
      languageId: clampInt(v.languageId, 1, 999999, d.vinted.languageId),
      priceFrom: clamp(v.priceFrom, 0, 10000, d.vinted.priceFrom),
      currency: /^[A-Z]{3}$/.test(String(v.currency ?? "")) ? String(v.currency) : d.vinted.currency,
      order: cleanString(v.order, d.vinted.order, 60),
      sellerResolveCap: clampInt(v.sellerResolveCap, 0, 10000, d.vinted.sellerResolveCap),
      excludedSources: cleanStringList(v.excludedSources, d.vinted.excludedSources, 30, 64),
      primeSession: cleanBool(v.primeSession, d.vinted.primeSession),
      primeWithBrowser: cleanBool(v.primeWithBrowser, d.vinted.primeWithBrowser),
    },
    scraping: {
      userAgents: cleanStringList(s.userAgents, d.scraping.userAgents, 30, 400),
    },
    library: {
      branches: cleanBranches(l.branches, d.library.branches),
      concurrency: clampInt(l.concurrency, 1, 12, d.library.concurrency),
      excludedSources: cleanStringList(l.excludedSources, d.library.excludedSources, 30, 64),
    },
    sync: {
      awards: cleanAwards(y.awards, d.sync.awards),
      writeConcurrency: clampInt(y.writeConcurrency, 1, 10, d.sync.writeConcurrency),
      dupAuthorThreshold: clamp(y.dupAuthorThreshold, 0.5, 1, d.sync.dupAuthorThreshold),
      dupTitleThreshold: clamp(y.dupTitleThreshold, 0.5, 1, d.sync.dupTitleThreshold),
    },
    ui: {
      shelfRowsPerPage: clampInt(u.shelfRowsPerPage, 1, 12, d.ui.shelfRowsPerPage),
      preciseShelfDrop: cleanBool(u.preciseShelfDrop, d.ui.preciseShelfDrop),
      statsOrder: cleanIdList(u.statsOrder),
    },
  };
}

const eq = (a: unknown, b: unknown): boolean => JSON.stringify(a) === JSON.stringify(b);

/**
 * Diff of the full config against the defaults — for storage we keep only what
 * the user actually changed (small blob + new knobs inherit defaults from code).
 */
export function diffFromDefaults(cfg: AppConfig): ConfigOverrides {
  const out: ConfigOverrides = {};
  for (const section of Object.keys(DEFAULT_CONFIG) as (keyof AppConfig)[]) {
    const overrides: Record<string, unknown> = {};
    const defSection = DEFAULT_CONFIG[section] as Record<string, unknown>;
    const curSection = cfg[section] as Record<string, unknown>;
    for (const key of Object.keys(defSection)) {
      if (!eq(curSection[key], defSection[key])) overrides[key] = curSection[key];
    }
    if (Object.keys(overrides).length > 0) (out as Record<string, unknown>)[section] = overrides;
  }
  return out;
}

/** Parses the blob from Notion; empty/corrupted → null (mergeConfig gets undefined = defaults only). */
export function parseStoredConfig(raw: string | null | undefined): ConfigOverrides | null {
  if (!raw || !raw.trim()) return null;
  try {
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === "object" ? (parsed as ConfigOverrides) : null;
  } catch {
    return null;
  }
}
