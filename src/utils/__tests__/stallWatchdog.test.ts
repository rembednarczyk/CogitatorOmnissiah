import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { createStallWatchdog } from "../stallWatchdog";

describe("createStallWatchdog", () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it("aborts and flags stalled after the timeout when never re-armed", () => {
    const w = createStallWatchdog(30000);
    w.arm();
    expect(w.signal.aborted).toBe(false);
    expect(w.stalled).toBe(false);

    vi.advanceTimersByTime(30000);

    expect(w.signal.aborted).toBe(true);
    expect(w.stalled).toBe(true);
  });

  it("re-arming resets the countdown (keepalive keeps the stream alive)", () => {
    const w = createStallWatchdog(30000);
    w.arm();
    vi.advanceTimersByTime(29000);
    w.arm(); // a chunk (or keepalive) arrived just in time
    vi.advanceTimersByTime(29000);
    expect(w.signal.aborted).toBe(false); // 58s elapsed but re-armed at 29s

    vi.advanceTimersByTime(1000); // now 30s of true silence
    expect(w.signal.aborted).toBe(true);
    expect(w.stalled).toBe(true);
  });

  it("clear() cancels a pending abort (normal completion path)", () => {
    const w = createStallWatchdog(30000);
    w.arm();
    w.clear();
    vi.advanceTimersByTime(60000);
    expect(w.signal.aborted).toBe(false);
    expect(w.stalled).toBe(false);
  });
});
