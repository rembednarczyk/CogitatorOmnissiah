// @vitest-environment node
import { describe, it, expect } from "vitest";
import { orderByIds, moveId, distributeColumns } from "../utils/statsLayout";

describe("orderByIds", () => {
  const all = ["a", "b", "c", "d"];

  it("zwraca kolejność kodu, gdy brak zapisu", () => {
    expect(orderByIds(all, [])).toEqual(["a", "b", "c", "d"]);
  });

  it("respektuje zapisaną kolejność", () => {
    expect(orderByIds(all, ["c", "a", "d", "b"])).toEqual(["c", "a", "d", "b"]);
  });

  it("dopisuje nowe karty (spoza zapisu) na końcu w kolejności kodu", () => {
    expect(orderByIds(all, ["b", "a"])).toEqual(["b", "a", "c", "d"]);
  });

  it("ignoruje id, których już nie ma w kodzie", () => {
    expect(orderByIds(all, ["z", "c", "y", "a"])).toEqual(["c", "a", "b", "d"]);
  });

  it("odrzuca duplikaty w zapisie", () => {
    expect(orderByIds(all, ["a", "a", "b"])).toEqual(["a", "b", "c", "d"]);
  });
});

describe("moveId", () => {
  const order = ["a", "b", "c", "d"];

  it("przenosi element w przód (przed cel)", () => {
    expect(moveId(order, "d", "b")).toEqual(["a", "d", "b", "c"]);
  });

  it("przenosi element w tył (wstawia przed cel na jego bieżącej pozycji)", () => {
    expect(moveId(order, "a", "c")).toEqual(["b", "a", "c", "d"]);
  });

  it("no-op gdy drag == target", () => {
    expect(moveId(order, "b", "b")).toEqual(order);
  });

  it("no-op gdy id nie istnieje", () => {
    expect(moveId(order, "x", "b")).toEqual(order);
    expect(moveId(order, "b", "x")).toEqual(order);
  });

  it("nie mutuje wejścia", () => {
    const copy = order.slice();
    moveId(order, "a", "d");
    expect(order).toEqual(copy);
  });
});

describe("distributeColumns", () => {
  it("round-robin do 2 kolumn (wiersz po wierszu)", () => {
    expect(distributeColumns(["a", "b", "c", "d", "e"], 2)).toEqual([
      ["a", "c", "e"],
      ["b", "d"],
    ]);
  });

  it("1 kolumna = wszystko w kolejności", () => {
    expect(distributeColumns(["a", "b", "c"], 1)).toEqual([["a", "b", "c"]]);
  });

  it("cols < 1 traktuje jak 1", () => {
    expect(distributeColumns(["a", "b"], 0)).toEqual([["a", "b"]]);
  });

  it("puste wejście → puste kolumny", () => {
    expect(distributeColumns([], 2)).toEqual([[], []]);
  });
});
