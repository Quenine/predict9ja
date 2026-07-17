import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
describe("context-aware receipt presentation", () => {
  const source = readFileSync(resolve(process.cwd(), "app/proofs/[receiptId]/page.tsx"), "utf8");
  it("explains replay evidence boundaries", () => {
    expect(source).toContain("Verified source evidence for historical replay");
    expect(source).toContain("What this proves");
    expect(source).toContain("What this does not prove");
    expect(source).toContain("does not validate the fictional payout");
  });
  it("keeps synthetic receipts concise and proof-field-free", () => {
    expect(source).toContain("Synthetic demo receipt");
    expect(source).toContain("No TxLINE proof is expected for this fictional fixture");
    expect(source).toContain('context.receiptContext === "HISTORICAL_REPLAY"');
  });
});
