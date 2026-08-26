import { describe, it, expect } from "vitest";
import { sortCycles } from "../utils/cycleSort";
import { HarvestCycle } from "../hooks/useCyclesHarvest";

const cyc = (over: Partial<HarvestCycle> & { cycle: string }): HarvestCycle => ({
  volumes: [], total: 0, inBase: 0, owned: 0, read: 0, missing: 0, acquirable: 0, ...over,
});

describe("sortCycles", () => {
  it("easywins: fewest still-to-read first, completed cycles sink to the bottom", () => {
    const cycles = [
      cyc({ cycle: "Trzy", total: 5, read: 2 }),   // toRead 3
      cyc({ cycle: "Zero", total: 4, read: 4 }),   // done → bottom
      cyc({ cycle: "Jeden", total: 3, read: 2 }),  // toRead 1
      cyc({ cycle: "Dwa", total: 6, read: 4 }),    // toRead 2
    ];
    const order = sortCycles(cycles, "easywins").map((c) => c.cycle);
    expect(order).toEqual(["Jeden", "Dwa", "Trzy", "Zero"]);
  });

  it("easywins: ties on to-read break by fewer to-acquire", () => {
    const cycles = [
      cyc({ cycle: "MaWiecej", total: 5, read: 3, owned: 1 }), // toRead 2, toAcquire 4
      cyc({ cycle: "MaMniej", total: 4, read: 2, owned: 3 }),  // toRead 2, toAcquire 1
    ];
    const order = sortCycles(cycles, "easywins").map((c) => c.cycle);
    expect(order).toEqual(["MaMniej", "MaWiecej"]);
  });

  it("acquire: most missing first (legacy behavior)", () => {
    const cycles = [
      cyc({ cycle: "Malo", missing: 1, total: 3 }),
      cyc({ cycle: "Duzo", missing: 5, total: 8 }),
      cyc({ cycle: "Srednio", missing: 3, total: 5 }),
    ];
    const order = sortCycles(cycles, "acquire").map((c) => c.cycle);
    expect(order).toEqual(["Duzo", "Srednio", "Malo"]);
  });

  it("does not mutate the input array", () => {
    const cycles = [cyc({ cycle: "B", total: 2, read: 1 }), cyc({ cycle: "A", total: 2, read: 0 })];
    const snapshot = cycles.map((c) => c.cycle);
    sortCycles(cycles, "easywins");
    expect(cycles.map((c) => c.cycle)).toEqual(snapshot);
  });
});
