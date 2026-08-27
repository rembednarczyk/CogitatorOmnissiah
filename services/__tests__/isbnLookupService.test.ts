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

  it("returns [] for an empty title without hitting the API", async () => {
    const r = await lookupIsbnsByTitle("   ", "Herbert");
    expect(r).toEqual([]);
    expect(mockedGet).not.toHaveBeenCalled();
  });

  it("queries intitle+inauthor and collects deduped ISBN-13s across editions", async () => {
    mockedGet.mockResolvedValue({
      data: { items: [
        { volumeInfo: { industryIdentifiers: [{ type: "ISBN_10", identifier: "0441172717" }, { type: "ISBN_13", identifier: "9780441172719" }] } },
        { volumeInfo: { industryIdentifiers: [{ type: "ISBN_13", identifier: "9788375780635" }] } },
        { volumeInfo: { industryIdentifiers: [{ type: "ISBN_13", identifier: "9780441172719" }] } }, // dup edition
      ] },
    });
    const r = await lookupIsbnsByTitle("Dune", "Frank Herbert");
    // ISBN-10 of the first volume normalizes to the same 13 as its ISBN_13 → deduped.
    expect(r).toEqual(["9780441172719", "9788375780635"]);
    const q = mockedGet.mock.calls[0][1].params.q;
    expect(q).toContain("intitle:Dune");
    expect(q).toContain("inauthor:Frank Herbert");
  });

  it("converts an ISBN-10-only edition to ISBN-13", async () => {
    mockedGet.mockResolvedValue({
      data: { items: [{ volumeInfo: { industryIdentifiers: [{ type: "ISBN_10", identifier: "0306406152" }] } }] },
    });
    const r = await lookupIsbnsByTitle("Some Book");
    expect(r).toEqual(["9780306406157"]);
  });

  it("returns [] when no volume carries a usable ISBN", async () => {
    mockedGet.mockResolvedValue({ data: { items: [{ volumeInfo: { industryIdentifiers: [{ type: "OTHER", identifier: "xyz" }] } }] } });
    const r = await lookupIsbnsByTitle("Nothing");
    expect(r).toEqual([]);
  });
});
