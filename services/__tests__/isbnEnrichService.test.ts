import { describe, it, expect, vi, beforeEach } from "vitest";
import { IsbnEnrichService } from "../isbnEnrichService";

// The reverse catalog lookup is mocked — we test the ritual's orchestration
// (filtering, merge, writes), not the HTTP calls.
vi.mock("../isbnLookupService", () => ({
  lookupIsbnsByTitle: vi.fn(),
}));
import { lookupIsbnsByTitle } from "../isbnLookupService";

const mockedLookup = lookupIsbnsByTitle as unknown as ReturnType<typeof vi.fn>;

function makeNotion(books: any[]) {
  return {
    queryAllBooks: vi.fn().mockResolvedValue(books),
    createColumnIfNeeded: vi.fn().mockResolvedValue(undefined),
    updatePage: vi.fn().mockResolvedValue(undefined),
    buildPropertyValue: vi.fn((v: string) => ({ rich_text: [{ text: { content: v } }] })),
  };
}

const complete = (events: any[]) => events.find((e) => e.type === "complete")?.result;

describe("IsbnEnrichService", () => {
  beforeEach(() => vi.clearAllMocks());

  it("processes every award book (not just empty ones) and writes the edition list", async () => {
    const notion = makeNotion([
      { id: "1", plTitle: "Diuna", origTitle: "Dune", author: "Herbert" },              // no ISBNs yet
      { id: "3", plTitle: "Tom", origTitle: "", author: "Y", kategoria: "Tom cyklu" },   // not an award → excluded
    ]);
    mockedLookup.mockResolvedValue(["9780441172719", "9788375780635"]);

    const events: any[] = [];
    const svc = new IsbnEnrichService(notion as any);
    await svc.runIsbnEnrich((e) => events.push(e), () => false);

    // Only the award book is looked up — by BOTH its titles (Polish + original).
    expect(mockedLookup).toHaveBeenCalledWith("Diuna", "Herbert");
    expect(mockedLookup).toHaveBeenCalledWith("Dune", "Herbert");
    expect(notion.updatePage).toHaveBeenCalledTimes(1);
    expect(notion.updatePage).toHaveBeenCalledWith("1", { ISBN: expect.anything() });
    // Polish edition (978-83…) is written FIRST so it survives Notion's char limit.
    expect(notion.buildPropertyValue).toHaveBeenCalledWith("9788375780635, 9780441172719", "rich_text");

    const result = complete(events);
    expect(result.updated).toBe(1);
  });

  it("MERGES newly-found ISBNs into a row that already has some (e.g. adds the Polish one)", async () => {
    const notion = makeNotion([
      { id: "1", plTitle: "Diuna", origTitle: "Dune", author: "Herbert", isbns: ["9780441172719"] },
    ]);
    // Catalog now returns the original AND a Polish edition ISBN.
    mockedLookup.mockResolvedValue(["9780441172719", "9788375780635"]);

    const events: any[] = [];
    const svc = new IsbnEnrichService(notion as any);
    await svc.runIsbnEnrich((e) => events.push(e), () => false);

    // The new Polish ISBN is kept and moved to the front; the original follows.
    expect(notion.buildPropertyValue).toHaveBeenCalledWith("9788375780635, 9780441172719", "rich_text");
    expect(complete(events).updated).toBe(1);
  });

  it("CLEANS UP a bloated row — caps to Polish-first even when nothing new is found", async () => {
    // A row polluted with many foreign editions (one Polish among them).
    const many = Array.from({ length: 60 }, (_, i) => `978000000${String(1000 + i)}`);
    const withPolish = ["9788375780635", ...many];
    const notion = makeNotion([
      { id: "1", plTitle: "Diuna", origTitle: "Dune", author: "Herbert", isbns: withPolish },
    ]);
    mockedLookup.mockResolvedValue([]); // catalogs add nothing new this run

    const events: any[] = [];
    const svc = new IsbnEnrichService(notion as any);
    await svc.runIsbnEnrich((e) => events.push(e), () => false);

    // Rewritten: capped to 40, Polish ISBN first.
    expect(notion.updatePage).toHaveBeenCalledTimes(1);
    const written = notion.buildPropertyValue.mock.calls[0][0] as string;
    const list = written.split(", ");
    expect(list.length).toBe(40);
    expect(list[0]).toBe("9788375780635");
    expect(complete(events).updated).toBe(1);
  });

  it("leaves a row unchanged (no write) when the catalogs add nothing new", async () => {
    const notion = makeNotion([
      { id: "1", plTitle: "Diuna", origTitle: "Dune", author: "Herbert", isbns: ["9780441172719"] },
    ]);
    mockedLookup.mockResolvedValue(["9780441172719"]); // already stored

    const events: any[] = [];
    const svc = new IsbnEnrichService(notion as any);
    await svc.runIsbnEnrich((e) => events.push(e), () => false);

    expect(notion.updatePage).not.toHaveBeenCalled();
    const result = complete(events);
    expect(result.updated).toBe(0);
    expect(result.unchanged).toBe(1);
  });

  it("records a book as skipped when the catalogs find no ISBN (no write)", async () => {
    const notion = makeNotion([{ id: "1", plTitle: "Nieznana", origTitle: "", author: "Z" }]);
    mockedLookup.mockResolvedValue([]);

    const events: any[] = [];
    const svc = new IsbnEnrichService(notion as any);
    await svc.runIsbnEnrich((e) => events.push(e), () => false);

    expect(notion.updatePage).not.toHaveBeenCalled();
    const result = complete(events);
    expect(result.updated).toBe(0);
    expect(result.summary.skipped).toContain("Nieznana");
  });

  it("reports a book as errored when every lookup throws (and keeps existing ISBNs)", async () => {
    const notion = makeNotion([{ id: "1", plTitle: "Diuna", origTitle: "", author: "Z" }]);
    mockedLookup.mockRejectedValue(new Error("wszystkie źródła 429"));

    const events: any[] = [];
    const svc = new IsbnEnrichService(notion as any);
    await svc.runIsbnEnrich((e) => events.push(e), () => false);

    expect(notion.updatePage).not.toHaveBeenCalled();
    const result = complete(events);
    expect(result.errors.some((e: string) => e.includes("Diuna"))).toBe(true);
  });

  it("reports a mid-run cancellation as a stop, not a false complete", async () => {
    const notion = makeNotion([
      { id: "1", plTitle: "A", origTitle: "A", author: "X" },
      { id: "2", plTitle: "B", origTitle: "B", author: "Y" },
    ]);
    mockedLookup.mockResolvedValue(["9788375780635"]);
    // False on the 1st call (pre-loop guard passes), true afterwards → cancel lands AFTER the
    // loop starts, exercising the post-loop check (not the pre-loop early return).
    let calls = 0;
    const checkCancel = () => calls++ > 0;
    const events: any[] = [];
    const svc = new IsbnEnrichService(notion as any);
    await svc.runIsbnEnrich((e) => events.push(e), checkCancel);

    expect(events.find((e) => e.type === "complete")).toBeUndefined();
    expect(events.some((e) => e.type === "status" && /Przerwano/.test(e.message))).toBe(true);
  });

  it("creates the ISBN column before writing", async () => {
    const notion = makeNotion([{ id: "1", plTitle: "T", origTitle: "T", author: "A" }]);
    mockedLookup.mockResolvedValue(["9780441172719"]);

    const svc = new IsbnEnrichService(notion as any);
    await svc.runIsbnEnrich(() => {}, () => false);

    expect(notion.createColumnIfNeeded).toHaveBeenCalledWith("ISBN", "rich_text");
  });
});
