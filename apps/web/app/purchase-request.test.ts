import { describe, expect, it } from "vitest";
import { parsePurchaseRequest } from "./purchase-request";
const valid = {
  marketId: "market",
  outcomeKey: "HOME",
  stakeCredits: 100,
  quoteVersion: 1,
  idempotencyKey: "request_key_123",
};
describe("purchase request", () => {
  it("accepts a bounded request", () => expect(parsePurchaseRequest(valid).success).toBe(true));
  it("rejects client-selected account identity", () =>
    expect(parsePurchaseRequest({ ...valid, accountId: "another-account" }).success).toBe(false));
  it("rejects invalid stake and idempotency", () => {
    expect(parsePurchaseRequest({ ...valid, stakeCredits: -1 }).success).toBe(false);
    expect(parsePurchaseRequest({ ...valid, idempotencyKey: "x" }).success).toBe(false);
  });
});
