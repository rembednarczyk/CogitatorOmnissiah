import { describe, it, expect, vi, beforeEach } from "vitest";
import axios from "axios";
import { lookupIsbn } from "../isbnLookupService";

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
