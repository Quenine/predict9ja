import { describe, expect, it } from "vitest";
import { judgeEvidenceState, selectJudgeProof } from "./evidence";

const proof = (overrides = {}) => ({
  validationStatus: "VERIFIED",
  fetchStatus: "FETCHED",
  observationClassification: "FINAL_MATCH_OBSERVATION",
  settlementEvidenceClassification: "FINAL_DATA_VERIFIED_NO_RECEIPT",
  sequence: 962,
  ...overrides,
});

describe("Judge Mode evidence", () => {
  it("does not pair a final proof with a later observation", () => {
    expect(selectJudgeProof(proof(), proof({ sequence: 963 }))?.sequence).toBe(962);
  });
  it("never shows verified wording without a proof", () => {
    expect(judgeEvidenceState(null).wording).not.toContain("verified");
  });
  it("never shows verified wording for a failed proof", () => {
    expect(judgeEvidenceState(proof({ validationStatus: "FAILED" })).wording).not.toContain(
      "verified",
    );
  });
  it("shows final-match wording for sequence 962", () => {
    expect(judgeEvidenceState(proof()).wording).toBe("Final match observation verified");
  });
  it("shows non-final wording for sequence 963", () => {
    expect(
      judgeEvidenceState(
        proof({
          sequence: 963,
          observationClassification: "IN_PLAY_OBSERVATION",
          settlementEvidenceClassification: "NOT_FINAL_SETTLEMENT_EVIDENCE",
        }),
      ).wording,
    ).toBe("Verified observation — not final settlement evidence");
  });
});
