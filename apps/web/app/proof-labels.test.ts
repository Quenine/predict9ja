import { describe, expect, it } from "vitest";
import { PROOF_LABELS } from "./proof-labels";

describe("proof UX labels", () => {
  it("keeps application, TxLINE, and Solana concepts separate", () => {
    expect(PROOF_LABELS.applicationDigest).toBe("Application receipt digest");
    expect(PROOF_LABELS.txlineDigest).toBe("TxLINE proof payload digest");
    expect(PROOF_LABELS.solanaValidation).toBe("Solana read-only validation");
  });
  it("distinguishes in-play from matching final evidence", () => {
    expect(PROOF_LABELS.inPlay).toContain("not final settlement evidence");
    expect(PROOF_LABELS.final).toBe("Final settlement data verified");
  });
});
