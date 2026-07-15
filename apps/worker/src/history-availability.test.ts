import { describe, expect, it } from "vitest";
import { classifyHistoricalAvailability } from "./history-availability";

const NOW = new Date("2026-07-15T12:00:00Z");

describe("historical availability", () => {
  it("classifies fixtures less than six hours old as too recent", () => {
    expect(classifyHistoricalAvailability(new Date("2026-07-15T07:00:01Z"), NOW)).toBe(
      "TOO_RECENT",
    );
  });

  it("classifies fixtures inside the documented window as eligible", () => {
    expect(classifyHistoricalAvailability(new Date("2026-07-15T06:00:00Z"), NOW)).toBe("ELIGIBLE");
  });

  it("classifies fixtures older than two weeks as too old", () => {
    expect(classifyHistoricalAvailability(new Date("2026-07-01T11:59:59Z"), NOW)).toBe("TOO_OLD");
  });

  it("classifies missing fixture metadata as unknown", () => {
    expect(classifyHistoricalAvailability(undefined, NOW)).toBe("UNKNOWN");
  });
});
