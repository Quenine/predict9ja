import { describe, expect, it, vi } from "vitest";
import { replayOrdered } from "./replay-engine";
describe("replay engine", () => {
  it("orders observations and scales time with a fake clock", async () => {
    const applied: number[] = [];
    const sleep = vi.fn(() => Promise.resolve());
    const result = await replayOrdered(
      [
        { sequence: 2, timestamp: new Date(2000) },
        { sequence: 1, timestamp: new Date(1000) },
      ],
      2,
      new AbortController().signal,
      (item) => {
        applied.push(item.sequence);
        return Promise.resolve();
      },
      { sleep },
    );
    expect(applied).toEqual([1, 2]);
    expect(sleep).toHaveBeenCalledWith(500, expect.any(AbortSignal));
    expect(result.cancelled).toBe(false);
  });
  it("supports cancellation", async () => {
    const controller = new AbortController();
    const applied: number[] = [];
    const result = await replayOrdered(
      [
        { sequence: 1, timestamp: new Date(0) },
        { sequence: 2, timestamp: new Date(1000) },
      ],
      1,
      controller.signal,
      (item) => {
        applied.push(item.sequence);
        controller.abort();
        return Promise.resolve();
      },
    );
    expect(applied).toEqual([1]);
    expect(result.cancelled).toBe(true);
  });
});
