import { describe, it, expect } from "vitest";
import { DEFAULT_CONFIG, mergeConfig, diffFromDefaults, parseStoredConfig } from "../configSchema";

describe("configSchema.mergeConfig", () => {
  it("returns exact defaults for empty/undefined/garbage input", () => {
    expect(mergeConfig(undefined)).toEqual(DEFAULT_CONFIG);
    expect(mergeConfig({})).toEqual(DEFAULT_CONFIG);
    expect(mergeConfig("nonsense")).toEqual(DEFAULT_CONFIG);
    expect(mergeConfig(null)).toEqual(DEFAULT_CONFIG);
  });

  it("applies overrides and keeps the rest at defaults", () => {
    const cfg = mergeConfig({ vinted: { resumeHours: 48, priceFrom: 5 } });
    expect(cfg.vinted.resumeHours).toBe(48);
    expect(cfg.vinted.priceFrom).toBe(5);
    expect(cfg.vinted.throttleMinMs).toBe(DEFAULT_CONFIG.vinted.throttleMinMs);
    expect(cfg.library).toEqual(DEFAULT_CONFIG.library);
  });

  it("clamps out-of-range numbers and rejects wrong types back to defaults", () => {
    const cfg = mergeConfig({
      vinted: { resumeHours: 999999, throttleMinMs: 1, retryAttempts: "trzy" as any, currency: "zloty" },
      library: { concurrency: -5 },
      sync: { dupAuthorThreshold: 2 },
      ui: { shelfRowsPerPage: 0 },
    });
    expect(cfg.vinted.resumeHours).toBe(8760);
    expect(cfg.vinted.throttleMinMs).toBe(500);
    expect(cfg.vinted.retryAttempts).toBe(DEFAULT_CONFIG.vinted.retryAttempts);
    expect(cfg.vinted.currency).toBe("PLN");
    expect(cfg.library.concurrency).toBe(1);
    expect(cfg.sync.dupAuthorThreshold).toBe(1);
    expect(cfg.ui.shelfRowsPerPage).toBe(1);
  });

  it("cleans list overrides: drops junk entries, falls back to defaults when empty", () => {
    const cfg = mergeConfig({
      scraping: { userAgents: ["  UA-1  ", "", 42 as any] },
      library: { branches: [{ id: "x", name: "Filia X", code: "9", sourceTag: "Tag" }, { id: "x", name: "dubel", code: "1", sourceTag: "T" }, { name: "bez id" } as any] },
      sync: { awards: [] },
    });
    expect(cfg.scraping.userAgents).toEqual(["UA-1"]);
    expect(cfg.library.branches).toEqual([{ id: "x", name: "Filia X", code: "9", sourceTag: "Tag" }]);
    expect(cfg.sync.awards).toEqual(DEFAULT_CONFIG.sync.awards); // pusta lista → defaulty
  });
});

describe("configSchema.diffFromDefaults", () => {
  it("is empty for pure defaults and minimal for single overrides", () => {
    expect(diffFromDefaults(mergeConfig(undefined))).toEqual({});
    const diff = diffFromDefaults(mergeConfig({ vinted: { resumeHours: 48 } }));
    expect(diff).toEqual({ vinted: { resumeHours: 48 } });
  });

  it("round-trips: merge(diff(cfg)) === cfg", () => {
    const cfg = mergeConfig({
      vinted: { resumeHours: 48, excludedSources: ["Posiadam"] },
      library: { concurrency: 3 },
      ui: { shelfRowsPerPage: 7 },
    });
    expect(mergeConfig(diffFromDefaults(cfg))).toEqual(cfg);
  });
});

describe("configSchema.parseStoredConfig", () => {
  it("parses valid JSON, tolerates empty/corrupt blobs", () => {
    expect(parseStoredConfig('{"vinted":{"resumeHours":48}}')).toEqual({ vinted: { resumeHours: 48 } });
    expect(parseStoredConfig("")).toBeNull();
    expect(parseStoredConfig(null)).toBeNull();
    expect(parseStoredConfig("{zepsuty json")).toBeNull();
    expect(parseStoredConfig('"string"')).toBeNull();
  });
});
