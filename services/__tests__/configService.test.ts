// @vitest-environment node
import { describe, it, expect, vi, beforeEach } from "vitest";
import { ConfigService } from "../configService";
import { NotionAdapter } from "../../notion.adapter";
import { mergeConfig } from "../../src/configSchema";

describe("ConfigService", () => {
  let notion: any;
  let svc: ConfigService;

  beforeEach(() => {
    notion = { getAppConfigRaw: vi.fn(), saveAppConfigRaw: vi.fn() };
    svc = new ConfigService(notion as unknown as NotionAdapter);
  });

  it("merges the stored diff over defaults", async () => {
    notion.getAppConfigRaw.mockResolvedValue(JSON.stringify({ ui: { shelfRowsPerPage: 9 } }));
    const cfg = await svc.getConfig(true);
    expect(cfg.ui.shelfRowsPerPage).toBe(9);              // override applied
    expect(cfg.library.branches.length).toBeGreaterThan(0); // defaults still present
  });

  it("falls back to defaults on a corrupt blob (never throws)", async () => {
    notion.getAppConfigRaw.mockResolvedValue("{not json");
    expect(await svc.getConfig(true)).toEqual(mergeConfig(undefined));
  });

  it("falls back to defaults when Notion read throws", async () => {
    notion.getAppConfigRaw.mockRejectedValue(new Error("network"));
    expect(await svc.getConfig(true)).toEqual(mergeConfig(undefined));
  });

  it("saves ONLY the diff from defaults, not whole config", async () => {
    await svc.saveConfig({ ui: { shelfRowsPerPage: 8 } });
    const stored = JSON.parse(notion.saveAppConfigRaw.mock.calls[0][0]);
    expect(stored.ui.shelfRowsPerPage).toBe(8);
    expect(stored.library).toBeUndefined(); // niezmienione sekcje nie są składowane
  });

  it("stores empty string when nothing differs from defaults", async () => {
    await svc.saveConfig(mergeConfig(undefined));
    expect(notion.saveAppConfigRaw).toHaveBeenCalledWith("");
  });

  it("caches within TTL (single Notion read for repeated getConfig)", async () => {
    notion.getAppConfigRaw.mockResolvedValue("");
    await svc.getConfig();
    await svc.getConfig();
    expect(notion.getAppConfigRaw).toHaveBeenCalledTimes(1);
  });
});
