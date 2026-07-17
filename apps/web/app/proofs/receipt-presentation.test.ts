import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

describe("context-aware receipt presentation", () => {
  const source = readFileSync(resolve(process.cwd(), "app/proofs/[receiptId]/page.tsx"), "utf8");

  it("renders the required historical replay evidence disclaimer", () => {
    expect(source).toContain("Historical TxLINE replay");
    expect(source).toContain("Verified source evidence");
    expect(source).toContain(
      "This proof verifies the final TxLINE observation used as the source for this historical",
    );
    expect(source).toContain(
      "The fictional prediction and payout occurred inside Predict9ja’s isolated demo",
    );
  });

  it("uses a concise synthetic receipt instead of empty proof sections", () => {
    expect(source).toContain("Synthetic demo receipt");
    expect(source).toContain("No TxLINE proof is expected for this fictional fixture");
    expect(source).toContain('context.receiptContext === "STANDARD"');
  });
});
