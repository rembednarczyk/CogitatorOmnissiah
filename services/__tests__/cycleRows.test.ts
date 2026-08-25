// @vitest-environment node
import { describe, it, expect } from "vitest";
import { buildCycleVolumeProperties, aggregateCycleRows, cycleLpLabel } from "../cycleRows";
import { NotionBook } from "../../src/types";

describe("buildCycleVolumeProperties", () => {
  it("buduje wiersz Tom cyklu z Kategoria/Cykl/CyklNr/Część cyklu + autor", () => {
    const p = buildCycleVolumeProperties({ title: "Bohater Wieków", author: "Brandon Sanderson", cycleName: "Mistborn", nr: 3 });
    expect(p["Kategoria"]).toEqual({ select: { name: "Tom cyklu" } });
    expect(p["Cykl"].rich_text[0].text.content).toBe("Mistborn");
    expect(p["CyklNr"]).toEqual({ number: 3 });
    expect(p["Część cyklu"]).toEqual({ checkbox: true });
    // Lp (kolumna tytułowa) = etykieta cyklu, tytuł żyje w „Tytuł polski".
    expect(p["Lp"].title[0].text.content).toBe("Mistborn (3)");
    expect(p["Tytuł polski"].rich_text[0].text.content).toBe("Bohater Wieków");
    // Tytuł polski linkuje do strony tomu w encyklopedii (jak oryginalne rytuały).
    expect(p["Tytuł polski"].rich_text[0].text.link).toEqual({
      url: "https://encyklopediafantastyki.pl/index.php?title=Bohater_Wiek%C3%B3w",
    });
    expect(p["Autor"].multi_select).toEqual([{ name: "Brandon Sanderson" }]);
  });

  it("cycleLpLabel: 'Nazwa (nr)', fallback gdy brak nazwy", () => {
    expect(cycleLpLabel("Mistborn", 2)).toBe("Mistborn (2)");
    expect(cycleLpLabel("", 1)).toBe("Cykl (1)");
  });

  it("pomija Autora gdy brak", () => {
    const p = buildCycleVolumeProperties({ title: "T", cycleName: "C", nr: 1 });
    expect(p["Autor"]).toBeUndefined();
  });
});

describe("aggregateCycleRows", () => {
  const mk = (id: string, over: Partial<NotionBook>): NotionBook => ({
    id, plTitle: `T${id}`, origTitle: "", awards: [], zrodlo: [], ...over,
  } as NotionBook);

  it("grupuje po Cykl, sortuje po CyklNr, liczy statusy (do zdobycia = ani owned ani read)", () => {
    const books = [
      mk("1", { plTitle: "Tom 1", cykl: "Mistborn", cyklNr: 1, zrodlo: ["Przeczytane", "Posiadam"], awards: ["Hugo"] }),
      mk("3", { plTitle: "Tom 3", cykl: "Mistborn", cyklNr: 3, kategoria: "Tom cyklu" }),
      mk("2", { plTitle: "Tom 2", cykl: "Mistborn", cyklNr: 2, kategoria: "Tom cyklu", zrodlo: ["Posiadam"] }),
      mk("x", { plTitle: "Bez cyklu" }), // brak pola Cykl → pomijane
    ];
    const out = aggregateCycleRows(books);
    expect(out.totalCycles).toBe(1);
    const c = out.cycles[0];
    expect(c.cycle).toBe("Mistborn");
    expect(c.volumes.map((v) => v.title)).toEqual(["Tom 1", "Tom 2", "Tom 3"]); // po CyklNr
    expect(c.volumes[0].isAward).toBe(true);
    expect(c.volumes[1].isAward).toBe(false);
    expect(c.total).toBe(3);
    expect(c.owned).toBe(2);
    expect(c.read).toBe(1);
    expect(c.missing).toBe(1); // Tom 3: ani owned ani read
  });

  it("sortuje cykle malejąco po 'do zdobycia'", () => {
    const out = aggregateCycleRows([
      mk("a", { cykl: "Mało", cyklNr: 1, zrodlo: ["Posiadam"] }),
      mk("b", { cykl: "Mało", cyklNr: 2, zrodlo: ["Przeczytane"] }),
      mk("c", { cykl: "Dużo", cyklNr: 1 }),
      mk("d", { cykl: "Dużo", cyklNr: 2 }),
    ]);
    expect(out.cycles[0].cycle).toBe("Dużo");
    expect(out.cycles[0].missing).toBe(2);
  });

  it("brak wierszy z Cykl → pusto", () => {
    expect(aggregateCycleRows([mk("a", {})])).toEqual({ cycles: [], totalCycles: 0, harvestedAt: null });
  });
});
