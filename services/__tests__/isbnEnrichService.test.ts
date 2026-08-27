import { describe, it, expect, vi, beforeEach } from "vitest";
import { IsbnEnrichService } from "../isbnEnrichService";

// The reverse Google Books lookup is mocked — we test the ritual's orchestration
// (filtering, idempotent skip, writes), not the HTTP call.
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

  it("enriches only award books that lack ISBNs, and writes all edition codes as a list", async () => {
    const notion = makeNotion([
      { id: "1", plTitle: "Diuna", origTitle: "Dune", author: "Herbert" },              // target
      { id: "2", plTitle: "Ma ISBN", origTitle: "Has ISBN", author: "X", isbns: ["9788375780635"] }, // already has ISBNs → skip
      { id: "3", plTitle: "Tom", origTitle: "", author: "Y", kategoria: "Tom cyklu" },   // not an award → skip
    ]);
    mockedLookup.mockResolvedValue(["9780441172719", "9788375780635"]);

    const events: any[] = [];
    const svc = new IsbnEnrichService(notion as any);
    await svc.runIsbnEnrich((e) => events.push(e), () => false);

    // Only the one target book was looked up + written.
    expect(mockedLookup).toHaveBeenCalledTimes(1);
    expect(mockedLookup).toHaveBeenCalledWith("Dune", "Herbert");
    expect(notion.updatePage).toHaveBeenCalledTimes(1);
    expect(notion.updatePage).toHaveBeenCalledWith("1", { ISBN: expect.anything() });
    // The full edition list is joined into the written value.
    expect(notion.buildPropertyValue).toHaveBeenCalledWith("9780441172719, 9788375780635", "rich_text");

    const result = complete(events);
    expect(result.synced).toBe(1);
    expect(result.skipped).toBe(1); // one award book already had ISBNs
  });

  it("records a book as skipped when Google Books finds no ISBN (no write)", async () => {
    const notion = makeNotion([{ id: "1", plTitle: "Nieznana", origTitle: "", author: "Z" }]);
    mockedLookup.mockResolvedValue([]);

    const events: any[] = [];
    const svc = new IsbnEnrichService(notion as any);
    await svc.runIsbnEnrich((e) => events.push(e), () => false);

    expect(notion.updatePage).not.toHaveBeenCalled();
    const result = complete(events);
    expect(result.synced).toBe(0);
    expect(result.summary.skipped).toContain("Nieznana");
  });

  it("creates the ISBN column before writing", async () => {
    const notion = makeNotion([{ id: "1", plTitle: "T", origTitle: "T", author: "A" }]);
    mockedLookup.mockResolvedValue(["9780441172719"]);

    const svc = new IsbnEnrichService(notion as any);
    await svc.runIsbnEnrich(() => {}, () => false);

    expect(notion.createColumnIfNeeded).toHaveBeenCalledWith("ISBN", "rich_text");
  });
});
