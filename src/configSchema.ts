/**
 * Schemat konfiguracji aplikacji (knoby z zakładki „Konfiguracja").
 *
 * Moduł WSPÓŁDZIELONY frontend/backend (czysty TS, zero zależności Node) — frontend
 * bierze stąd typy i DEFAULT_CONFIG (formularz + reset), backend merge/clamp/diff.
 * Zasada przechowywania: w Notion (opis kolumny `AppConfig`) ląduje wyłącznie
 * **diff od defaultów** — mały blob, a nowe knoby w kodzie dostają defaulty bez
 * migracji. Wartości domyślne = dokładnie dotychczasowe zachowanie aplikacji.
 */

export interface LibraryBranch {
  id: string;
  name: string;
  code: string;
  /** Tag „Źródło" dopisywany po oznaczeniu książki jako dostępnej w tej filii. */
  sourceTag: string;
}

export interface AwardPage {
  name: string;
  /** Tytuł strony w Archiwum Encyklopedii Fantastyki. */
  title: string;
}

export interface AppConfig {
  vinted: {
    /** Okno „Kontynuuj": pomiń książki skanowane w ostatnich N h. */
    resumeHours: number;
    /** Minimalny odstęp między żądaniami (ms). */
    throttleMinMs: number;
    /** Losowy jitter dokładany do odstępu (ms). */
    throttleJitterMs: number;
    /** Timeout pojedynczego żądania HTTP (ms). NIE skracaj pochopnie — patrz backlog. */
    requestTimeoutMs: number;
    /** Liczba prób withRetry. */
    retryAttempts: number;
    /** Bazowy backoff między próbami (ms). */
    retryBackoffMs: number;
    /** Kategoria katalogu Vinted (2319 = beletrystyka). */
    catalogId: number;
    /** Filtr języka ofert (6440 = polski). */
    languageId: number;
    /** Dolny próg ceny (odcina oferty-śmieci). */
    priceFrom: number;
    currency: string;
    /** Sortowanie wyników katalogu. */
    order: string;
    /** Limit ustaleń sprzedawców na przebieg; 0 = bez limitu. */
    sellerResolveCap: number;
    /** Tagi „Źródło" wykluczające książkę ze skanu Vinted. */
    excludedSources: string[];
  };
  scraping: {
    /** Pula User-Agentów (rotacja per żądanie). Odświeżaj co kilka miesięcy. */
    userAgents: string[];
  };
  library: {
    branches: LibraryBranch[];
    /** Równoległość zapytań OPAC. */
    concurrency: number;
    /** Tagi wykluczające ze skanu bibliotecznego (celowo osobna lista — bez „Audioteka"). */
    excludedSources: string[];
  };
  sync: {
    /** Strony nagród na wiki (Hugo/Nebula/Locus) — źródło pełnej synchronizacji i diagnostyki. */
    awards: AwardPage[];
    /** Równoległość zapisów do Notion (bookSync / cycles). */
    writeConcurrency: number;
    /** Próg podobieństwa autorów przy wykrywaniu duplikatów (0–1). */
    dupAuthorThreshold: number;
    /** Próg podobieństwa tytułów (PL i oryginalnego) przy duplikatach (0–1). */
    dupTitleThreshold: number;
  };
  ui: {
    /** Liczba rzędów regału na stronę (Regał N/M). */
    shelfRowsPerPage: number;
    /** Precyzyjny drag&drop na regale (wstawianie w szczelinę w obrębie dekady). */
    preciseShelfDrop: boolean;
    /** Kolejność kart w „Analizie Zasobów" (id sekcji). Puste = domyślna kolejność z kodu. */
    statsOrder: string[];
  };
}

/** Głęboki partial konfiguracji (kształt nadpisań składowanych w Notion). */
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

/* ==================== Normalizacja / clampy ==================== */

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

/** Lista identyfikatorów (np. kolejność kart) — dozwolona pusta, dedup, przycięcie. */
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
 * Scala nadpisania z defaultami i clampuje każdą wartość do bezpiecznego zakresu.
 * Nieznane pola są ignorowane, złe typy wracają do defaultu — funkcja NIGDY nie
 * rzuca (uszkodzony blob w Notion nie może zabić aplikacji).
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
 * Diff pełnej konfiguracji względem defaultów — do składowania trzymamy tylko to,
 * co user faktycznie zmienił (mały blob + nowe knoby dziedziczą defaulty z kodu).
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

/** Parsuje blob z Notion; pusty/uszkodzony → null (mergeConfig dostanie undefined = same defaulty). */
export function parseStoredConfig(raw: string | null | undefined): ConfigOverrides | null {
  if (!raw || !raw.trim()) return null;
  try {
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === "object" ? (parsed as ConfigOverrides) : null;
  } catch {
    return null;
  }
}
