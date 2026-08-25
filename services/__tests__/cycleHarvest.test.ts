// @vitest-environment node
import { describe, it, expect } from "vitest";
import { buildCycleBlob, serializeCycleBlob, parseCycleBlob, sameCycleContent } from "../cycleHarvest";
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
