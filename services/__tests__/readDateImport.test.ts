import { describe, it, expect } from "vitest";
import { parseReadDate, parseImportCsv, buildReadDatePlan, MatchableBook } from "../readDateImport";

describe("parseReadDate", () => {
  it("parses a full dd.mm.yyyy date as day precision", () => {
    expect(parseReadDate("28.08.2026")).toEqual({ iso: "2026-08-28", precision: "day" });
    expect(parseReadDate("05.07.2026")).toEqual({ iso: "2026-07-05", precision: "day" });
  });

  it("snaps a year-only value to Jan 1", () => {
    expect(parseReadDate("2006")).toEqual({ iso: "2006-01-01", precision: "year" });
  });

  it("snaps a month value (yyyy-mm and mm.yyyy) to the 1st", () => {
    expect(parseReadDate("2024-01")).toEqual({ iso: "2024-01-01", precision: "month" });
    expect(parseReadDate("2020-09")).toEqual({ iso: "2020-09-01", precision: "month" });
    expect(parseReadDate("03.2019")).toEqual({ iso: "2019-03-01", precision: "month" });
  });

  it("accepts an ISO full date", () => {
    expect(parseReadDate("2022-11-30")).toEqual({ iso: "2022-11-30", precision: "day" });
  });

  it("rejects impossible and unrecognized dates", () => {
    expect(parseReadDate("32.01.2020")).toBeNull(); // no such day
    expect(parseReadDate("10.13.2020")).toBeNull(); // no such month
    expect(parseReadDate("2020-13")).toBeNull();
    expect(parseReadDate("")).toBeNull();
    expect(parseReadDate("wczoraj")).toBeNull();
  });
});

describe("parseImportCsv", () => {
  it("strips the BOM + header and reads fixed columns", () => {
    const csv = "﻿tytul;autor;data_przeczytania;link\n" +
      "Behemot;Peter Watts;28.08.2026;https://example.com/a\n" +
      "Nocarz;Magdalena Kozak;2006;https://example.com/b\n";
    const rows = parseImportCsv(csv);
    expect(rows).toHaveLength(2);
    expect(rows[0]).toEqual({ tytul: "Behemot", autor: "Peter Watts", dataRaw: "28.08.2026", link: "https://example.com/a" });
    expect(rows[1].dataRaw).toBe("2006");
  });

  it("folds a stray delimiter into the link column, not the fixed fields", () => {
    const csv = "tytul;autor;data_przeczytania;link\n" +
      "T;A;2020;https://x/a;b\n";
    const rows = parseImportCsv(csv);
    expect(rows[0]).toEqual({ tytul: "T", autor: "A", dataRaw: "2020", link: "https://x/a;b" });
  });

  it("skips blank lines", () => {
    const csv = "tytul;autor;data_przeczytania;link\n\nT;A;2020;u\n\n";
    expect(parseImportCsv(csv)).toHaveLength(1);
  });
});

const book = (id: string, plTitle: string, author: string, extra: Partial<MatchableBook> = {}): MatchableBook =>
  ({ id, plTitle, author, ...extra });

describe("buildReadDatePlan", () => {
  it("matches on author+title and resolves the date", () => {
    const books = [book("b1", "Behemot", "Peter Watts")];
    const plan = buildReadDatePlan(
      [{ tytul: "Behemot", autor: "Peter Watts", dataRaw: "28.08.2026", link: "" }],
      books,
    );
    expect(plan.updates).toEqual([
      { id: "b1", iso: "2026-08-28", precision: "day", matchedBy: "author+title", csvTitle: "Behemot", dateRaw: "28.08.2026" },
    ]);
    expect(plan.unmatched).toHaveLength(0);
  });

  it("falls back to a UNIQUE title when the author differs, but not when the title is shared", () => {
    const unique = [book("b1", "Rozgwiazda", "Peter Watts")];
    const planU = buildReadDatePlan(
      [{ tytul: "Rozgwiazda", autor: "P. Watts (inne zapisy)", dataRaw: "2025", link: "" }],
      unique,
    );
    expect(planU.updates.map(u => u.id)).toEqual(["b1"]);
    expect(planU.updates[0].matchedBy).toBe("unique-title");

    const shared = [book("b1", "Wir", "Peter Watts"), book("b2", "Wir", "Ktoś Inny")];
    const planS = buildReadDatePlan(
      [{ tytul: "Wir", autor: "Ktoś Zupełnie Trzeci", dataRaw: "2025", link: "" }],
      shared,
    );
    expect(planS.updates).toHaveLength(0);
    expect(planS.ambiguous).toHaveLength(1);
    expect(planS.ambiguous[0].bookIds.sort()).toEqual(["b1", "b2"]);
  });

  it("reports CSV rows with no book in the base as unmatched (never invents a row)", () => {
    const books = [book("b1", "Behemot", "Peter Watts")];
    const plan = buildReadDatePlan(
      [{ tytul: "Zupełnie Inna Książka", autor: "Nieznany", dataRaw: "2010", link: "" }],
      books,
    );
    expect(plan.updates).toHaveLength(0);
    expect(plan.unmatched).toHaveLength(1);
  });

  it("collapses several CSV rows for one book, keeping the earliest date", () => {
    const books = [book("b1", "Wir", "Peter Watts")];
    const plan = buildReadDatePlan(
      [
        { tytul: "Wir", autor: "Peter Watts", dataRaw: "25.07.2026", link: "" },
        { tytul: "Wir", autor: "Peter Watts", dataRaw: "01.02.2019", link: "" },
      ],
      books,
    );
    expect(plan.updates).toHaveLength(1);
    expect(plan.updates[0].iso).toBe("2019-02-01");
    expect(plan.collapsed).toBe(1);
  });

  it("skips a book that already has a date unless overwrite is set", () => {
    const books = [book("b1", "Behemot", "Peter Watts", { dataPrzeczytania: "2020-01-01" })];
    const rows = [{ tytul: "Behemot", autor: "Peter Watts", dataRaw: "28.08.2026", link: "" }];

    const noOverwrite = buildReadDatePlan(rows, books, { overwrite: false });
    expect(noOverwrite.updates).toHaveLength(0);
    expect(noOverwrite.skippedExisting).toHaveLength(1);

    const overwrite = buildReadDatePlan(rows, books, { overwrite: true });
    expect(overwrite.updates).toHaveLength(1);
    expect(overwrite.skippedExisting).toHaveLength(0);
  });

  it("collects rows with an unparseable date separately", () => {
    const books = [book("b1", "Behemot", "Peter Watts")];
    const plan = buildReadDatePlan(
      [{ tytul: "Behemot", autor: "Peter Watts", dataRaw: "kiedyś", link: "" }],
      books,
    );
    expect(plan.updates).toHaveLength(0);
    expect(plan.unparseableDate).toHaveLength(1);
  });
});
