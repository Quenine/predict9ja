export type JudgeProof = Readonly<{
  validationStatus: string;
  fetchStatus: string;
  observationClassification: string;
  settlementEvidenceClassification: string;
}>;

export function selectJudgeProof<T extends JudgeProof>(
  verifiedFinal: T | null,
  fallback: T | null,
): T | null {
  return verifiedFinal ?? fallback;
}

export function judgeEvidenceState(proof: JudgeProof | null) {
  if (!proof) return { state: "NO_PROOF" as const, wording: "No proof available" };
  if (proof.validationStatus === "NOT_REQUESTED" || proof.validationStatus === "VERIFYING")
    return {
      state: "FETCHED_NOT_VERIFIED" as const,
      wording:
        proof.fetchStatus === "FETCHED"
          ? "Proof fetched — validation not completed"
          : "Proof validation not completed",
    };
  if (proof.validationStatus !== "VERIFIED")
    return { state: "VERIFICATION_FAILED" as const, wording: "Verification failed" };
  if (proof.settlementEvidenceClassification === "FINAL_SETTLEMENT_VERIFIED")
    return { state: "FINAL_SETTLEMENT" as const, wording: "Final settlement verified" };
  if (proof.observationClassification === "FINAL_MATCH_OBSERVATION")
    return { state: "FINAL_MATCH" as const, wording: "Final match observation verified" };
  return {
    state: "VERIFIED_NON_FINAL" as const,
    wording: "Verified observation — not final settlement evidence",
  };
}
