import { renderHook, act } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { useSSEStream, defaultStallMessage } from "../useSSEStream";

const streamOf = (...frames: string[]) => {
  const encoder = new TextEncoder();
  const reader = { read: vi.fn() };
  frames.forEach((f) => reader.read.mockResolvedValueOnce({ value: encoder.encode(f), done: false }));
  reader.read.mockResolvedValueOnce({ value: undefined, done: true });
  return { ok: true, body: { getReader: () => reader } };
};

describe("useSSEStream", () => {
  beforeEach(() => vi.stubGlobal("fetch", vi.fn()));

  it("defaultStallMessage reports the timeout in seconds", () => {
    expect(defaultStallMessage(120000)).toContain("120 s");
    expect(defaultStallMessage(30000)).toContain("30 s");
  });

  it("consumes the stream and routes events, returning ok", async () => {
    (global.fetch as any).mockResolvedValue(streamOf(
      'data: {"type":"status","message":"Hi"}\n\n',
      'data: {"type":"complete","result":{"ok":true}}\n\n',
    ));
    const seen: string[] = [];
    const { result } = renderHook(() => useSSEStream("/api/x"));

    let out: any;
    await act(async () => {
      out = await result.current.run({}, (e) => {
        seen.push(e.type);
        if (e.type === "complete") return true;
      });
    });

    expect(seen).toEqual(["status", "complete"]);
    expect(out).toEqual({ ok: true, error: null, stalled: false });
  });

  it("surfaces a server error body on non-ok response", async () => {
    (global.fetch as any).mockResolvedValue({ ok: false, status: 500, json: () => Promise.resolve({ error: "Boom" }) });
    const { result } = renderHook(() => useSSEStream("/api/x"));

    let out: any;
    await act(async () => { out = await result.current.run({}, () => {}); });

    expect(out.ok).toBe(false);
    expect(out.error).toBe("Boom");
    expect(out.stalled).toBe(false);
  });

  it("propagates an error thrown from onEvent (server error event)", async () => {
    (global.fetch as any).mockResolvedValue(streamOf('data: {"type":"error","error":"Nope"}\n\n'));
    const { result } = renderHook(() => useSSEStream("/api/x"));

    let out: any;
    await act(async () => {
      out = await result.current.run({}, (e) => { if (e.type === "error") throw new Error((e as any).error); });
    });

    expect(out.ok).toBe(false);
    expect(out.error).toBe("Nope");
  });
});
