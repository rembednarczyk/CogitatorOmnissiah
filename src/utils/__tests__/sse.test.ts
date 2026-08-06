import { describe, it, expect, vi } from "vitest";
import { consumeSSE } from "../sse";

const enc = new TextEncoder();

/** Build a minimal SSE body whose reader yields the given string chunks in order. */
function mockBody(chunks: string[]) {
  let i = 0;
  const reader = {
    read: vi.fn(async () => {
      if (i < chunks.length) return { value: enc.encode(chunks[i++]), done: false };
      return { value: undefined, done: true };
    }),
    cancel: vi.fn(async () => {}),
  };
  return { getReader: () => reader, _reader: reader } as any;
}

describe("consumeSSE", () => {
  it("parses complete events and dispatches them in order", async () => {
    const body = mockBody([
      'data: {"type":"status","message":"A"}\n\n',
      'data: {"type":"progress","current":1,"total":2}\n\n',
    ]);
    const events: any[] = [];
    await consumeSSE(body, (e) => { events.push(e); });
    expect(events).toEqual([
      { type: "status", message: "A" },
      { type: "progress", current: 1, total: 2 },
    ]);
  });

  it("reassembles an event split across two TCP reads", async () => {
    const body = mockBody([
      'data: {"type":"sta',
      'tus","message":"joined"}\n\n',
    ]);
    const events: any[] = [];
    await consumeSSE(body, (e) => { events.push(e); });
    expect(events).toEqual([{ type: "status", message: "joined" }]);
  });

  it("stops early when the callback returns true and cancels the reader", async () => {
    const body = mockBody([
      'data: {"type":"complete","result":1}\n\n',
      'data: {"type":"status","message":"after"}\n\n',
    ]);
    const seen: any[] = [];
    await consumeSSE(body, (e) => {
      seen.push(e);
      if (e.type === "complete") return true;
    });
    expect(seen).toHaveLength(1);
    expect(seen[0].type).toBe("complete");
    // early exit must release the stream so the fetch connection isn't leaked
    expect(body._reader.cancel).toHaveBeenCalled();
  });

  it("does NOT cancel the reader on natural stream completion", async () => {
    const body = mockBody(['data: {"type":"status","message":"A"}\n\n']);
    await consumeSSE(body, () => {});
    expect(body._reader.cancel).not.toHaveBeenCalled();
  });

  it("skips malformed JSON without aborting the stream", async () => {
    const body = mockBody([
      'data: {broken\n\n',
      'data: {"type":"status","message":"ok"}\n\n',
    ]);
    const errSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    const events: any[] = [];
    await consumeSSE(body, (e) => { events.push(e); });
    expect(events).toEqual([{ type: "status", message: "ok" }]);
    expect(errSpy).toHaveBeenCalled();
    errSpy.mockRestore();
  });

  it("fires onChunk once per read and is a no-op on a null body", async () => {
    const onChunk = vi.fn();
    const body = mockBody(['data: {"type":"status"}\n\n', 'data: {"type":"status"}\n\n']);
    await consumeSSE(body, () => {}, onChunk);
    expect(onChunk).toHaveBeenCalledTimes(2);

    const cb = vi.fn();
    await consumeSSE(null, cb);
    expect(cb).not.toHaveBeenCalled();
  });

  it("propagates a throw from the callback (error events)", async () => {
    const body = mockBody(['data: {"type":"error","error":"boom"}\n\n']);
    await expect(
      consumeSSE(body, (e) => { if (e.type === "error") throw new Error(e.error); })
    ).rejects.toThrow("boom");
  });
});
