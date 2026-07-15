import { describe, expect, it } from "vitest";
import {
  calculatePosition,
  canonicalReceiptFields,
  canTransitionMarketLifecycle,
  resolveMarket,
  validateQuotePrices,
} from "./markets";
describe("quotes and positions", () => {
  it("requires quotes to total 10,000", () => {
    expect(validateQuotePrices([4500, 2800, 2700])).toBe(true);
    expect(validateQuotePrices([5000, 4999])).toBe(false);
  });
  it("uses deterministic integer rounding", () =>
    expect(calculatePosition(100, 4500)).toEqual({
      sharesMicros: 222_222_222,
      potentialPayoutCredits: 222,
    }));
});
describe("market lifecycle", () => {
  it("enforces terminal and readiness transitions", () => {
    expect(canTransitionMarketLifecycle("CLOSED", "RESOLUTION_READY")).toBe(true);
    expect(canTransitionMarketLifecycle("RESOLVED", "ACTIVE")).toBe(false);
  });
});
describe("resolution rules", () => {
  const base = {
    participant1Goals: 2,
    participant2Goals: 1,
    participant1IsHome: true,
    finalised: true,
  };
  it("maps match result for either participant order and draws", () => {
    expect(resolveMarket({ ...base, ruleVersion: "match-result@1" }).winningOutcomeKey).toBe(
      "HOME",
    );
    expect(
      resolveMarket({ ...base, participant1IsHome: false, ruleVersion: "match-result@1" })
        .winningOutcomeKey,
    ).toBe("AWAY");
    expect(
      resolveMarket({ ...base, participant1Goals: 1, ruleVersion: "match-result@1" })
        .winningOutcomeKey,
    ).toBe("DRAW");
  });
  it("resolves totals and both teams", () => {
    expect(resolveMarket({ ...base, ruleVersion: "total-goals-2.5@1" }).winningOutcomeKey).toBe(
      "OVER",
    );
    expect(
      resolveMarket({ ...base, participant2Goals: 0, ruleVersion: "both-teams-to-score@1" })
        .winningOutcomeKey,
    ).toBe("NO");
  });
  it("rejects unfinished and unknown rules", () => {
    expect(() =>
      resolveMarket({ ...base, finalised: false, ruleVersion: "match-result@1" }),
    ).toThrow("game_finalised");
    expect(() => resolveMarket({ ...base, ruleVersion: "unknown" })).toThrow("Unsupported");
  });
});
describe("canonical receipt", () => {
  it("is field-order independent and material-sensitive", () => {
    const first = canonicalReceiptFields({ b: 2, a: "x" });
    expect(first).toBe(canonicalReceiptFields({ a: "x", b: 2 }));
    expect(first).not.toBe(canonicalReceiptFields({ a: "x", b: 3 }));
  });
});
