import { describe, expect, it } from "vitest";
import { positionStatus } from "./presentation";
const value = (
  settledAt: Date | null,
  actualPayoutCredits: number | null,
  settlementStatus = "SETTLED",
) => ({
  settledAt,
  actualPayoutCredits,
  market: { receipt: settledAt ? { settlementStatus } : null },
});
describe("position presentation", () => {
  it("distinguishes open, won, lost and void positions", () => {
    expect(positionStatus(value(null, null))).toBe("open");
    expect(positionStatus(value(new Date(), 200))).toBe("won");
    expect(positionStatus(value(new Date(), 0))).toBe("lost");
    expect(positionStatus(value(new Date(), 100, "VOID"))).toBe("void");
  });
});
