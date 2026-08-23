import { describe, it, expect } from "vitest";
import { selectAndOrderCandidates, scannedMs, EXCLUDED_SOURCES } from "../vintedScanPlanner";
import { serializeVintedData } from "../vintedStore";
import { NotionBook } from "../../src/types";

const book = (over: Partial<NotionBook>): NotionBook => ({
  id: over.id ?? "x", plTitle: "T", origTitle: "", awards: [], zrodlo: [],
  currentWydawnictwo: "", currentSeria: "", lp: "", plTitleRichText: [], origTitleRichText: [], ...over,
});

const scannedBook = (id: string, iso: string): NotionBook =>
  book({ id, plTitle: `B-${id}`, vintedData: serializeVintedData({ scannedAt: iso, offers: [] }) });

describe("vintedScanPlanner.selectAndOrderCandidates", () => {
  it("excludes owned/read/library sources and title-less rows", () => {
    const books = [
      book({ id: "keep", plTitle: "Keep" }),
      book({ id: "owned", plTitle: "Owned", zrodlo: ["Posiadam"] }),
      book({ id: "read", plTitle: "Read", zrodlo: ["Przeczytane"] }),
      book({ id: "notitle", plTitle: "  " }),
    ];
    const { candidates } = selectAndOrderCandidates(books);
    expect(candidates.map((b) => b.id)).toEqual(["keep"]);
  });

  it("covers every documented excluded source", () => {
    for (const src of EXCLUDED_SOURCES) {
      expect(selectAndOrderCandidates([book({ id: "b", plTitle: "B", zrodlo: [src] })]).candidates).toHaveLength(0);
    }
  });

  it("orders oldest-scanned first, with never-scanned (-Infinity) at the very front", () => {
    const books = [
      scannedBook("new", "2026-03-10T00:00:00.000Z"),
      book({ id: "never", plTitle: "Never" }),
      scannedBook("old", "2026-03-01T00:00:00.000Z"),
    ];
    expect(selectAndOrderCandidates(books).candidates.map((b) => b.id)).toEqual(["never", "old", "new"]);
  });

  it("skips books scanned within the resume window and reports the count", () => {
    const now = Date.parse("2026-03-10T12:00:00.000Z");
    const books = [
      scannedBook("fresh", "2026-03-10T06:00:00.000Z"),  // 6h ago → skipped (< 12h)
      scannedBook("stale", "2026-03-08T00:00:00.000Z"),  // >2d ago → kept
      book({ id: "never", plTitle: "Never" }),           // never → kept
    ];
    const { candidates, skipped } = selectAndOrderCandidates(books, 12, now);
    expect(skipped).toBe(1);
    expect(candidates.map((b) => b.id)).toEqual(["never", "stale"]);
  });
});

describe("vintedScanPlanner.scannedMs", () => {
  it("returns -Infinity for never-scanned or invalid", () => {
    expect(scannedMs(book({}))).toBe(-Infinity);
    expect(scannedMs(scannedBook("s", "2026-03-01T00:00:00.000Z"))).toBe(Date.parse("2026-03-01T00:00:00.000Z"));
  });
});
