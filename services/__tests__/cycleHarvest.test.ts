// @vitest-environment node
import { describe, it, expect } from "vitest";
import { buildCycleBlob, serializeCycleBlob, parseCycleBlob, sameCycleContent, mergeCycleCaches } from "../cycleHarvest";
import { CycleView } from "../cycleLookupService";

const view: CycleView = {
  cycleName: "Mistborn",
  source: "chain",
  unreadBefore: 1,
  volumes: [
    { title: "Z mgły zrodzony", isCurrent: false, inBase: true, read: true, owned: true, awarded: false, awards: [] },
    { title: "Studnia Wstąpienia", isCurrent: true, inBase: true, read: false, owned: false, awarded: true, awards: ["Hugo"] },
    { title: "Bohater Wieków", isCurrent: false, inBase: false, read: false, owned: false, awarded: false, awards: [] },
  ],
};

describe("buildCycleBlob", () => {
  it("mapuje widok na kompaktowy blob (flagi 0/1, ts z zewnątrz)", () => {
    const blob = buildCycleBlob(view, 12345);
    expect(blob).toEqual({
      v: 1,
      ts: 12345,
      cycle: "Mistborn",
      src: "chain",
      vols: [
        { t: "Z mgły zrodzony", cur: 0, b: 1, r: 1, o: 1, a: 0 },
        { t: "Studnia Wstąpienia", cur: 1, b: 1, r: 0, o: 0, a: 1 },
        { t: "Bohater Wieków", cur: 0, b: 0, r: 0, o: 0, a: 0 },
      ],
    });
  });
});

describe("parseCycleBlob", () => {
  it("round-trip serialize→parse zachowuje treść", () => {
    const blob = buildCycleBlob(view, 999);
    expect(parseCycleBlob(serializeCycleBlob(blob))).toEqual(blob);
  });

  it("pusty/uszkodzony/obcy blob → null", () => {
    expect(parseCycleBlob(undefined)).toBeNull();
    expect(parseCycleBlob("")).toBeNull();
    expect(parseCycleBlob("   ")).toBeNull();
    expect(parseCycleBlob("{nie json")).toBeNull();
    expect(parseCycleBlob(JSON.stringify({ v: 2, vols: [] }))).toBeNull();
    expect(parseCycleBlob(JSON.stringify({ v: 1, vols: "x" }))).toBeNull();
  });

  it("odrzuca tomy bez tytułu i normalizuje flagi do 0/1", () => {
    const parsed = parseCycleBlob(JSON.stringify({ v: 1, ts: 1, cycle: "C", src: "chain", vols: [{ t: "A", r: true }, { x: 1 }] }));
    expect(parsed?.vols).toEqual([{ t: "A", cur: 0, b: 0, r: 1, o: 0, a: 0 }]);
  });
});

describe("sameCycleContent", () => {
  it("ignoruje ts przy porównaniu treści", () => {
    const a = buildCycleBlob(view, 1);
    const b = buildCycleBlob(view, 99999);
    expect(sameCycleContent(a, b)).toBe(true);
  });

  it("wykrywa zmianę statusu tomu", () => {
    const a = buildCycleBlob(view, 1);
    const changed = { ...view, volumes: view.volumes.map((v, i) => (i === 2 ? { ...v, owned: true } : v)) };
    const b = buildCycleBlob(changed, 1);
    expect(sameCycleContent(a, b)).toBe(false);
  });

  it("wykrywa zmianę liczby / kolejności tomów i null", () => {
    const a = buildCycleBlob(view, 1);
    const shorter = buildCycleBlob({ ...view, volumes: view.volumes.slice(0, 2) }, 1);
    expect(sameCycleContent(a, shorter)).toBe(false);
    expect(sameCycleContent(a, null)).toBe(false);
  });
});

describe("mergeCycleCaches", () => {
  const blob = (cycle: string, ts: number, vols: any[]) =>
    ({ cycleCache: JSON.stringify({ v: 1, ts, cycle, src: "chain", vols }) });

  it("grupuje po cyklu, dedupuje tomy i OR-uje statusy między pozycjami", () => {
    const books = [
      blob("Mistborn", 100, [
        { t: "Tom 1", b: 1, r: 1, o: 1, a: 0 },
        { t: "Tom 2", b: 1, r: 0, o: 0, a: 1 },
      ]),
      // druga pozycja z tego samego cyklu: Tom 2 posiadany + nowy Tom 3 spoza bazy
      blob("Mistborn", 200, [
        { t: "Tom 2", b: 1, r: 0, o: 1, a: 1 },
        { t: "Tom 3", b: 0, r: 0, o: 0, a: 0 },
      ]),
    ];
    const out = mergeCycleCaches(books);
    expect(out.totalCycles).toBe(1);
    expect(out.harvestedAt).toBe(200);
    const c = out.cycles[0];
    expect(c.cycle).toBe("Mistborn");
    expect(c.volumes.map((v) => v.title)).toEqual(["Tom 1", "Tom 2", "Tom 3"]);
    expect(c.volumes[1].owned).toBe(true); // OR z drugiej pozycji
    expect(c.total).toBe(3);
    expect(c.inBase).toBe(2);
    expect(c.missing).toBe(1);
    expect(c.owned).toBe(2);
    expect(c.read).toBe(1);
  });

  it("sortuje cykle malejąco po liczbie brakujących tomów", () => {
    const books = [
      blob(" Mało braku", 1, [{ t: "A", b: 1 }, { t: "B", b: 0 }]),
      blob("Dużo braku", 1, [{ t: "C", b: 0 }, { t: "D", b: 0 }, { t: "E", b: 0 }]),
    ];
    const out = mergeCycleCaches(books);
    expect(out.cycles[0].missing).toBe(3);
    expect(out.cycles[1].missing).toBe(1);
  });

  it("pomija książki bez/uszkodzonym blobem", () => {
    const out = mergeCycleCaches([{}, { cycleCache: "" }, { cycleCache: "{bad" }]);
    expect(out).toEqual({ cycles: [], totalCycles: 0, harvestedAt: null });
  });
});
