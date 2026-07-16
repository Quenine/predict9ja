import { describe, expect, it } from "vitest";
import { buildValidationSupportBundle } from "./support-bundle";

const bundle = () =>
  buildValidationSupportBundle({
    network: "devnet",
    fixtureId: "18241006",
    sequence: 962,
    statKeys: [1, 2],
    statValues: [1, 2],
    proofTimestamp: null,
    proofPayloadDigest: "digest",
    validationStatus: "VERIFIED",
    observationClassification: "FINAL_MATCH_OBSERVATION",
    settlementEvidenceClassification: "FINAL_DATA_VERIFIED_NO_RECEIPT",
    verifiedAt: "2026-07-16T00:00:00.000Z",
    epochDay: 20_000,
    programId: "program",
    dailyRootPda: "pda",
    providerMode: "LOCAL_DIAGNOSTIC_WALLET",
    diagnostic: { preflight: { status: "PASSED" } },
  });

describe("validation support bundle", () => {
  it("includes safe top-level proof and classification fields", () => {
    expect(bundle()).toMatchObject({
      proofPayloadDigest: "digest",
      validationStatus: "VERIFIED",
      observationClassification: "FINAL_MATCH_OBSERVATION",
      settlementEvidenceClassification: "FINAL_DATA_VERIFIED_NO_RECEIPT",
      verifiedAt: "2026-07-16T00:00:00.000Z",
    });
  });
  it("excludes credentials, wallet paths, and raw proof arrays", () => {
    const serialized = JSON.stringify(bundle());
    for (const field of ["apiToken", "jwt", "walletPath", "privateKey", "subTreeProof"])
      expect(serialized).not.toContain(field);
  });
});
