// @vitest-environment node
import { describe, it, expect, vi, beforeEach } from "vitest";
import { CycleHarvestService } from "../cycleHarvestService";
import { NotionAdapter } from "../../notion.adapter";
import { CycleLookupService, CycleView } from "../cycleLookupService";
import { fakeConfig } from "./testConfig";

const view = (over: Partial<CycleView> = {}): CycleView => ({
  cycleName: "Saga",
  source: "chain",
  unreadBefore: 0,
  volumes: [
    { title: "Tom 1", isCurrent: true, inBase: true, read: false, owned: false, awarded: true, awards: ["Hugo"] },
    { title: "Tom 2", isCurrent: false, inBase: false, read: false, owned: false, awarded: false, awards: [] },
  ],
  ...over,
});

describe("CycleHarvestService.runCycleHarvest", () => {
  let notion: any;
  let lookup: any;
  let svc: CycleHarvestService;
  const collect = async () => {
    const events: any[] = [];
    await svc.runCycleHarvest((e) => events.push(e), () => false);
    return events;
  };

  beforeEach(() => {
    notion = {
      createColumnIfNeeded: vi.fn(),
      getBooksForStats: vi.fn(),
      addRow: vi.fn(async () => ({ id: "new-id" })),
      updatePage: vi.fn(),
    };
    lookup = { lookup: vi.fn() };
    svc = new CycleHarvestService(notion as unknown as NotionAdapter, lookup as unknown as CycleLookupService, fakeConfig);
  });

  it("creates missing volumes as rows and tags the existing anchor", async () => {
    notion.getBooksForStats.mockResolvedValue([
      { id: "anchor", plTitle: "Tom 1", origTitle: "", currentCzesccyklu: true, awards: ["Hugo"], zrodlo: [] },
    ]);
    lookup.lookup.mockResolvedValue(view());

    const events = await collect();

    // Tom 1 istnieje jako wiersz nagrodowy → dotagowany Cykl/CyklNr (nie duplikowany).
    expect(notion.updatePage).toHaveBeenCalledWith("anchor", expect.objectContaining({ CyklNr: { number: 1 } }));
    // Tom 2 spoza bazy → utworzony jako nowy wiersz.
    expect(notion.addRow).toHaveBeenCalledTimes(1);
    const done = events.find((e) => e.type === "complete");
    expect(done.result).toMatchObject({ added: 1, updated: 1 });
  });

  it("is idempotent — an already-tagged base makes no writes", async () => {
    notion.getBooksForStats.mockResolvedValue([
      { id: "anchor", plTitle: "Tom 1", origTitle: "", currentCzesccyklu: true, awards: ["Hugo"], zrodlo: [], cykl: "Saga", cyklNr: 1 },
      { id: "vol2", plTitle: "Tom 2", origTitle: "", currentCzesccyklu: false, kategoria: "Tom cyklu", awards: [], zrodlo: [], cykl: "Saga", cyklNr: 2, lp: "Saga (2)",
        plTitleRichText: [{ text: { content: "Tom 2", link: { url: "https://encyklopediafantastyki.pl/index.php?title=Tom_2" } } }] },
    ]);
    lookup.lookup.mockResolvedValue(view());

    const events = await collect();

    expect(notion.addRow).not.toHaveBeenCalled();   // brak duplikatu
    expect(notion.updatePage).not.toHaveBeenCalled(); // brak zbędnych zapisów
    const done = events.find((e) => e.type === "complete");
    expect(done.result).toMatchObject({ added: 0, updated: 0 });
  });

  it("reports anchors with no siblings as skipped, writes nothing", async () => {
    notion.getBooksForStats.mockResolvedValue([
      { id: "a", plTitle: "Solo", origTitle: "", currentCzesccyklu: true, awards: [], zrodlo: [] },
    ]);
    lookup.lookup.mockResolvedValue(view({ volumes: [view().volumes[0]] })); // tylko 1 tom

    const events = await collect();
    expect(notion.addRow).not.toHaveBeenCalled();
    const done = events.find((e) => e.type === "complete");
    expect(done.result.summary.skipped).toContain("Solo");
  });
});
