/**
 * @vitest-environment node
 */
import { describe, it, expect, vi, beforeEach, afterAll } from "vitest";
import request from "supertest";

process.env.NODE_ENV = "test";

// A controllable runBookSync implementation — each test injects its own via a holder.
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
    // Make sure nothing is left from the previous test
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
    // executeTask sets currentTask synchronously, before yielding control
    expect(syncManager.isSyncing).toBe(true);
    expect(syncManager.activeTask).toBe("book");

    await expect(syncManager.run("purify", vi.fn())).rejects.toThrow(/już w toku/);

    // stopActiveSync sets a cancellation flag visible through the task token
    expect(captured()).toBe(false);
    expect(syncManager.stopActiveSync()).toBe(true);
    expect(captured()).toBe(true);

    release();
    await running;

    // Lock released after the task finishes
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
    // Cancellation signaled, but the lock is HELD — no window for concurrent
    // writes: the orphaned task still owns the lock until it exits.
    expect(captured()).toBe(true);
    expect(syncManager.isSyncing).toBe(true);
    await expect(syncManager.run("purify", vi.fn())).rejects.toThrow(/już w toku/);

    release(); // the task notices the cancellation and exits → finally releases the lock
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

describe("GET /api/cycles-harvest", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    process.env.NOTION_API_KEY = "test-key";
    process.env.NOTION_DATABASE_ID = "test-db";
  });

  it("passes fresh=false by default (may reuse the books cache)", async () => {
    const spy = vi.spyOn(syncManager, "getCyclesHarvest").mockResolvedValue({ cycles: [], totalCycles: 0, harvestedAt: null } as any);
    const res = await request(app).get("/api/cycles-harvest");
    expect(res.status).toBe(200);
    expect(spy).toHaveBeenCalledWith(false);
  });

  it("threads fresh=1 (manual refresh) through to bypass the cache", async () => {
    const spy = vi.spyOn(syncManager, "getCyclesHarvest").mockResolvedValue({ cycles: [], totalCycles: 0, harvestedAt: null } as any);
    const res = await request(app).get("/api/cycles-harvest?fresh=1");
    expect(res.status).toBe(200);
    expect(spy).toHaveBeenCalledWith(true);
  });
});

describe("GET /api/isbn/:code", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    process.env.NOTION_API_KEY = "test-key";
    process.env.NOTION_DATABASE_ID = "test-db";
  });

  it("rejects an invalid ISBN with 400 and never calls the resolver", async () => {
    const spy = vi.spyOn(syncManager, "lookupIsbn").mockResolvedValue(null as any);
    const res = await request(app).get("/api/isbn/not-an-isbn");
    expect(res.status).toBe(400);
    expect(spy).not.toHaveBeenCalled();
  });

  it("returns 404 when the ISBN resolves to nothing", async () => {
    const spy = vi.spyOn(syncManager, "lookupIsbn").mockResolvedValue(null as any);
    const res = await request(app).get("/api/isbn/9780306406157");
    expect(res.status).toBe(404);
    expect(spy).toHaveBeenCalledWith("9780306406157");
  });

  it("returns the resolved book on a hit", async () => {
    const book = { isbn: "9780306406157", title: "T", author: "A", source: "google-books" as const };
    vi.spyOn(syncManager, "lookupIsbn").mockResolvedValue(book);
    const res = await request(app).get("/api/isbn/0306406152"); // ISBN-10 → normalized to 13
    expect(res.status).toBe(200);
    expect(res.body).toEqual(book);
  });
});

describe("POST /api/mark-as-read", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    process.env.NOTION_API_KEY = "test-key";
    process.env.NOTION_DATABASE_ID = "test-db";
  });

  it("defaults to the 'Przeczytane' tag when none is provided", async () => {
    const spy = vi.spyOn(syncManager, "markAsRead").mockResolvedValue(undefined);

    const res = await request(app).post("/api/mark-as-read").send({ pageId: "page-1" });

    expect(res.status).toBe(200);
    expect(res.body).toEqual({ success: true });
    expect(spy).toHaveBeenCalledWith("page-1", "Przeczytane");
  });

  it("threads a branch source tag through to the sync manager", async () => {
    const spy = vi.spyOn(syncManager, "markAsRead").mockResolvedValue(undefined);

    await request(app).post("/api/mark-as-read").send({ pageId: "page-2", tag: "Biblioteka" });
    await request(app).post("/api/mark-as-read").send({ pageId: "page-3", tag: "Biblioteka 9" });
    await request(app).post("/api/mark-as-read").send({ pageId: "page-5", tag: "Posiadam" });

    expect(spy).toHaveBeenNthCalledWith(1, "page-2", "Biblioteka");
    expect(spy).toHaveBeenNthCalledWith(2, "page-3", "Biblioteka 9");
    expect(spy).toHaveBeenNthCalledWith(3, "page-5", "Posiadam");
  });

  it("rejects an unknown tag with 400 and never touches Notion", async () => {
    const spy = vi.spyOn(syncManager, "markAsRead").mockResolvedValue(undefined);

    const res = await request(app).post("/api/mark-as-read").send({ pageId: "page-4", tag: "Nagroda" });

    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/Niedozwolony znacznik/);
    expect(spy).not.toHaveBeenCalled();
  });

  it("requires a pageId", async () => {
    const spy = vi.spyOn(syncManager, "markAsRead").mockResolvedValue(undefined);

    const res = await request(app).post("/api/mark-as-read").send({ tag: "Biblioteka" });

    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/Missing pageId/);
    expect(spy).not.toHaveBeenCalled();
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
    // The first event is the server handshake, the last is complete
    expect(frames[0]).toMatchObject({ type: "status" });
    expect(frames[0].message).toMatch(/Połączono/);
    expect(types).toContain("progress");
    expect(types[types.length - 1]).toBe("complete");
    expect(frames[frames.length - 1].result).toEqual({ success: true });

    // Lock released after the stream closes
    expect(syncManager.isSyncing).toBe(false);
  });

  it("rejects a second sync with 400 while one is already streaming", async () => {
    let release!: () => void;
    h.runBook = () => new Promise<void>((r) => { release = r; });

    // .then() actually sends the supertest request (it's lazy) — we keep it in flight
    const firstDone = request(app)
      .post("/api/sync")
      .send({ awardName: "A", pageTitle: "B" })
      .then((r) => r);

    // Wait until the first sync takes the lock
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
