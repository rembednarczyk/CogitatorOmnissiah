/**
 * @vitest-environment node
 */
import { describe, it, expect, vi, beforeEach, afterAll } from "vitest";
import request from "supertest";

process.env.NODE_ENV = "test";

// Sterowalna implementacja runBookSync — każdy test podstawia własną przez holder.
const h = vi.hoisted(() => ({
  runBook: null as null | ((params: any, send: (e: any) => void, checkCancel: () => boolean) => Promise<void>),
}));

vi.mock("../notion.adapter", () => {
  const NotionAdapter = vi.fn();
  NotionAdapter.prototype.init = vi.fn().mockResolvedValue(undefined);
  NotionAdapter.prototype.getSchema = vi.fn().mockResolvedValue({});
  return { NotionAdapter };
});

vi.mock("../wiki.adapter", () => {
  const WikiAdapter = vi.fn();
  return { WikiAdapter };
});

vi.mock("../services/bookSyncService", () => {
  const BookSyncService = vi.fn();
  BookSyncService.prototype.runBookSync = (p: any, s: (e: any) => void, c: () => boolean) =>
    h.runBook ? h.runBook(p, s, c) : Promise.resolve();
  BookSyncService.prototype.fetchBooksFromMediaWiki = () => Promise.resolve([]);
  return { BookSyncService };
});

import { app, syncManager, closeServer } from "../server";

describe("SyncManager lifecycle", () => {
  beforeEach(() => {
    h.runBook = null;
    process.env.NOTION_API_KEY = "test-key";
    process.env.NOTION_DATABASE_ID = "test-db";
    // Upewnij się, że nie zostało nic z poprzedniego testu
    syncManager.resetSyncState();
  });

  it("is idle before any task runs", () => {
    expect(syncManager.isSyncing).toBe(false);
    expect(syncManager.activeTask).toBe(null);
  });

  it("holds a single-task lock and rejects a concurrent task", async () => {
    let release!: () => void;
    let captured!: () => boolean;
    h.runBook = (_p, _s, checkCancel) => {
      captured = checkCancel;
      return new Promise<void>((res) => { release = res; });
    };

    const running = syncManager.run("book", vi.fn(), {});
    // executeTask ustawia currentTask synchronicznie, zanim odda sterowanie
    expect(syncManager.isSyncing).toBe(true);
    expect(syncManager.activeTask).toBe("book");

    await expect(syncManager.run("purify", vi.fn())).rejects.toThrow(/już w toku/);

    // stopActiveSync ustawia flagę anulowania widoczną przez token zadania
    expect(captured()).toBe(false);
    expect(syncManager.stopActiveSync()).toBe(true);
    expect(captured()).toBe(true);

    release();
    await running;

    // Blokada zwolniona po zakończeniu zadania
    expect(syncManager.isSyncing).toBe(false);
    expect(syncManager.activeTask).toBe(null);
  });

  it("resetSyncState cancels the task and holds the lock until it settles (no concurrent task)", async () => {
    let release!: () => void;
    let captured!: () => boolean;
    h.runBook = (_p, _s, checkCancel) => {
      captured = checkCancel;
      return new Promise<void>((res) => { release = res; });
    };

    const running = syncManager.run("book", vi.fn(), {});
    expect(syncManager.isSyncing).toBe(true);

    syncManager.resetSyncState();
    // Anulowanie zasygnalizowane, ale blokada TRZYMANA — brak okna równoległych
    // zapisów: osierocone zadanie wciąż jest właścicielem locka aż do wyjścia.
    expect(captured()).toBe(true);
    expect(syncManager.isSyncing).toBe(true);
    await expect(syncManager.run("purify", vi.fn())).rejects.toThrow(/już w toku/);

    release(); // zadanie zauważa anulowanie i wychodzi → finally zwalnia lock
    await running;
    expect(syncManager.isSyncing).toBe(false);
    expect(syncManager.activeTask).toBe(null);
  });

  it("stopActiveSync returns false when nothing is running", () => {
    expect(syncManager.stopActiveSync()).toBe(false);
  });

  it("run() rejects an unknown ritual name without taking the lock", async () => {
    await expect(syncManager.run("bogus" as any, vi.fn())).rejects.toThrow(/Nieznany rytuał/);
    expect(syncManager.isSyncing).toBe(false);
  });

  afterAll(() => closeServer());
});

describe("SSE event stream (POST /api/sync)", () => {
  beforeEach(() => {
    process.env.NOTION_API_KEY = "test-key";
    process.env.NOTION_DATABASE_ID = "test-db";
    syncManager.resetSyncState();
  });

  const parseFrames = (raw: string) =>
    raw
      .split("\n\n")
      .filter((f) => f.startsWith("data: "))
      .map((f) => JSON.parse(f.slice("data: ".length)));

  it("streams a well-formed status → progress → complete sequence and closes", async () => {
    h.runBook = async (_p, send) => {
      send({ type: "status", message: "krok" });
      send({ type: "progress", current: 1, total: 2, message: "w toku" });
      send({ type: "complete", result: { success: true } });
    };

    const res = await request(app)
      .post("/api/sync")
      .send({ awardName: "Nagroda Hugo", pageTitle: "Hugo nagroda powieść", syncAll: false });

    expect(res.status).toBe(200);
    expect(res.header["content-type"]).toContain("text/event-stream");

    const frames = parseFrames(res.text);
    const types = frames.map((f) => f.type);
    // Pierwsze zdarzenie to handshake serwera, ostatnie to complete
    expect(frames[0]).toMatchObject({ type: "status" });
    expect(frames[0].message).toMatch(/Połączono/);
    expect(types).toContain("progress");
    expect(types[types.length - 1]).toBe("complete");
    expect(frames[frames.length - 1].result).toEqual({ success: true });

    // Lock zwolniony po zamknięciu strumienia
    expect(syncManager.isSyncing).toBe(false);
  });

  it("rejects a second sync with 400 while one is already streaming", async () => {
    let release!: () => void;
    h.runBook = () => new Promise<void>((r) => { release = r; });

    // .then() faktycznie wysyła żądanie supertest (jest leniwe) — trzymamy je w locie
    const firstDone = request(app)
      .post("/api/sync")
      .send({ awardName: "A", pageTitle: "B" })
      .then((r) => r);

    // Poczekaj aż pierwszy sync przejmie blokadę
    await vi.waitFor(() => expect(syncManager.isSyncing).toBe(true));

    const second = await request(app).post("/api/sync").send({ awardName: "C", pageTitle: "D" });
    expect(second.status).toBe(400);
    expect(second.body.error).toMatch(/już w toku/);

    release();
    await firstDone;
    expect(syncManager.isSyncing).toBe(false);
  });

  afterAll(() => closeServer());
});
