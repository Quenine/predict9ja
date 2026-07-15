import { describe, expect, it } from "vitest";
import { hashSessionToken, receiptDigest } from "./index";
describe("bounded security artifacts", () => {
  it("hashes opaque tokens with the configured secret", () => {
    expect(hashSessionToken("token", "secret-one-value")).not.toBe(
      hashSessionToken("token", "secret-two-value"),
    );
  });
  it("creates canonical material-sensitive receipt digests", () => {
    const first = receiptDigest({ marketId: "m", score: 2 });
    expect(first).toBe(receiptDigest({ score: 2, marketId: "m" }));
    expect(first).not.toBe(receiptDigest({ score: 3, marketId: "m" }));
    expect(first).toHaveLength(64);
  });
});
