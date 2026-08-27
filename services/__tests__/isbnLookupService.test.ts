import { describe, it, expect, vi, beforeEach } from "vitest";
import axios from "axios";
import { lookupIsbn, lookupIsbnsByTitle } from "../isbnLookupService";

vi.mock("axios");
const mockedGet = axios.get as unknown as ReturnType<typeof vi.fn>;

describe("lookupIsbn", () => {
  beforeEach(() => vi.clearAllMocks());

  it("returns null for an invalid ISBN without hitting the API", async () => {
    const r = await lookupIsbn("not-an-isbn");
    expect(r).toBeNull();
    expect(mockedGet).not.toHaveBeenCalled();
  });

  it("maps a Google Books hit to {isbn,title,author,year}", async () => {
    mockedGet.mockResolvedValue({
      data: { items: [{ volumeInfo: { title: "Diuna", subtitle: "Kroniki", authors: ["Frank Herbert"], publishedDate: "1965-08-01" } }] },
    });
    const r = await lookupIsbn("978-83-7578-063-5");
    expect(r).toEqual({ isbn: "9788375780635", title: "Diuna: Kroniki", author: "Frank Herbert", year: "1965", source: "google-books" });
  });

  it("returns null when Google Books has no volume for the ISBN", async () => {
    mockedGet.mockResolvedValue({ data: { totalItems: 0, items: [] } });
    const r = await lookupIsbn("9780306406157");
    expect(r).toBeNull();
  });
});

describe("lookupIsbnsByTitle", () => {
  beforeEach(() => vi.clearAllMocks());

  // The three sources run in parallel, so route the mock by URL rather than call order.
  // Each handler receives the axios config and returns the response body (`data`).
  const routeByUrl = (handlers: {
    google?: (q: string) => any;
    openlibrary?: (params: any) => any;
    bn?: (params: any) => any;
  }) => {
    mockedGet.mockImplementation((url: string, config: any) => {
      const params = config?.params || {};
      if (url.includes("googleapis.com")) return Promise.resolve({ data: handlers.google ? handlers.google(params.q) : { items: [] } });
      if (url.includes("openlibrary.org")) return Promise.resolve({ data: handlers.openlibrary ? handlers.openlibrary(params) : { docs: [] } });
      if (url.includes("data.bn.org.pl")) return Promise.resolve({ data: handlers.bn ? handlers.bn(params) : { bibs: [] } });
      return Promise.resolve({ data: {} });
    });
  };

  const googleVolumes = (...isbn13s: string[]) => ({
    items: isbn13s.map((id) => ({ volumeInfo: { industryIdentifiers: [{ type: "ISBN_13", identifier: id }] } })),
  });

  // A Biblioteka Narodowa bib carrying one MARC 020 $a ISBN (+ optional isbnIssn field).
  const bnBib = (marc020a: string, isbnIssn?: string) => {
    const subfields = [{ a: marc020a }];
    const bib: any = { marc: { fields: [{ "020": { subfields } }] } };
    if (isbnIssn) bib.isbnIssn = isbnIssn;
    return bib;
  };

  it("returns [] for an empty title without hitting any API", async () => {
    const r = await lookupIsbnsByTitle("   ", "Herbert");
    expect(r).toEqual([]);
    expect(mockedGet).not.toHaveBeenCalled();
  });

  it("sends Google Books a space-joined query (never a literal plus → %2B → 0 results)", async () => {
    routeByUrl({ google: () => googleVolumes("9780441172719") });
    await lookupIsbnsByTitle("Dune", "Frank Herbert");
    const googleCall = mockedGet.mock.calls.find((c) => String(c[0]).includes("googleapis.com"));
    const q = googleCall![1].params.q;
    expect(q).toBe("intitle:Dune inauthor:Frank Herbert");
    expect(q).not.toContain("+");
  });

  it("unions ISBNs across all three sources, deduped (incl. the Polish edition from BN)", async () => {
    routeByUrl({
      google: () => googleVolumes("9780441172719"),                                        // original (EN)
      openlibrary: () => ({ docs: [{ isbn: ["9780441172719", "0306406152"] }] }),          // dup + another
      bn: () => ({ bibs: [bnBib("978-83-7578-063-5 (opr. tw.)")] }),                        // Polish edition
    });
    const r = await lookupIsbnsByTitle("Diuna", "Herbert");
    expect(new Set(r)).toEqual(new Set(["9780441172719", "9780306406157", "9788375780635"]));
  });

  it("uses only the first author from a multi-value author field", async () => {
    routeByUrl({ google: () => googleVolumes("9780441172719") });
    await lookupIsbnsByTitle("Dune", "Frank Herbert, Kevin Anderson");
    const googleCall = mockedGet.mock.calls.find((c) => String(c[0]).includes("googleapis.com"));
    expect(googleCall![1].params.q).toBe("intitle:Dune inauthor:Frank Herbert");
  });

  it("reads BN ISBNs from both MARC 020 $a and the isbnIssn convenience field", async () => {
    routeByUrl({
      bn: () => ({ bibs: [bnBib("978-83-7648-090-9", "9788375780635")] }),
    });
    const r = await lookupIsbnsByTitle("Polska", "Autor");
    expect(new Set(r)).toEqual(new Set(["9788375780635", "9788376480909"]));
  });

  it("throws only when EVERY source errors (so 'no match' ≠ 'API down')", async () => {
    mockedGet.mockRejectedValue(new Error("ECONNRESET"));
    await expect(lookupIsbnsByTitle("X", "Y")).rejects.toThrow(/google-books.*openlibrary.*biblioteka-narodowa/s);
  });

  it("returns [] (not an error) when sources respond but nothing matches", async () => {
    routeByUrl({});
    const r = await lookupIsbnsByTitle("Nothing", "Someone");
    expect(r).toEqual([]);
  });

  it("still succeeds when some sources error, as long as one responds", async () => {
    mockedGet.mockImplementation((url: string) => {
      if (url.includes("data.bn.org.pl")) {
        return Promise.resolve({ data: { bibs: [bnBib("9788375780635")] } });
      }
      return Promise.reject(new Error("429")); // google + openlibrary rate-limited
    });
    const r = await lookupIsbnsByTitle("Diuna", "Herbert");
    expect(r).toEqual(["9788375780635"]);
  });
});
