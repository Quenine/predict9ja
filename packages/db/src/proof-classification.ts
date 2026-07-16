export type ObservationClassification =
  | "IN_PLAY_OBSERVATION"
  | "FINAL_MATCH_OBSERVATION"
  | "LOCAL_OBSERVATION_NOT_FOUND"
  | "LOCAL_VALUE_MISMATCH";

export type SettlementEvidenceClassification =
  "NOT_FINAL_SETTLEMENT_EVIDENCE" | "FINAL_DATA_VERIFIED_NO_RECEIPT" | "FINAL_SETTLEMENT_VERIFIED";

export type ProofClassificationWarning =
  "FINALISATION_PHASE_CONTRADICTION" | "FINALISATION_PERIOD_PRESENT";

type LocalObservation = Readonly<{
  id: string;
  fixtureId: string;
  fixtureSourceId: string;
  providerSequence: number;
  sourceMode: "LIVE" | "REPLAY" | "SYNTHETIC";
  action: string;
  finalised: boolean;
  phase?: string | null;
  period?: string | null;
  participant1Goals: number | null;
  participant2Goals: number | null;
}>;

type ReceiptRelation = Readonly<{
  fixtureId: string | null;
  finalObservationId: string | null;
  providerSequence: number | null;
  sourceMode: "LIVE" | "REPLAY" | "SYNTHETIC" | null;
  participant1Goals: number | null;
  participant2Goals: number | null;
}> | null;

export function classifyProofEvidence(
  input: Readonly<{
    proofFixtureSourceId: string;
    proofSequence: number;
    proofStatValues: readonly number[];
    validationStatus: string;
    observation: LocalObservation | null;
    receipt: ReceiptRelation;
  }>,
) {
  const observation = input.observation;
  let observationClassification: ObservationClassification;
  if (
    !observation ||
    observation.fixtureSourceId !== input.proofFixtureSourceId ||
    observation.providerSequence !== input.proofSequence
  ) {
    observationClassification = "LOCAL_OBSERVATION_NOT_FOUND";
  } else if (
    input.proofStatValues.length < 2 ||
    observation.participant1Goals !== input.proofStatValues[0] ||
    observation.participant2Goals !== input.proofStatValues[1]
  ) {
    observationClassification = "LOCAL_VALUE_MISMATCH";
  } else if (
    observation.sourceMode === "LIVE" &&
    observation.action === "game_finalised" &&
    observation.finalised
  ) {
    observationClassification = "FINAL_MATCH_OBSERVATION";
  } else {
    observationClassification = "IN_PLAY_OBSERVATION";
  }

  const warnings: ProofClassificationWarning[] = [];
  if (observationClassification === "FINAL_MATCH_OBSERVATION") {
    if (
      observation?.phase &&
      observation.phase !== "UNKNOWN" &&
      !observation.phase.startsWith("FINISHED")
    )
      warnings.push("FINALISATION_PHASE_CONTRADICTION");
    if (observation?.period) warnings.push("FINALISATION_PERIOD_PRESENT");
  }

  const receipt = input.receipt;
  const exactReceipt =
    input.validationStatus === "VERIFIED" &&
    observationClassification === "FINAL_MATCH_OBSERVATION" &&
    receipt?.sourceMode === "LIVE" &&
    receipt.fixtureId === observation?.fixtureId &&
    receipt.finalObservationId === observation.id &&
    receipt.providerSequence === input.proofSequence &&
    receipt.participant1Goals === input.proofStatValues[0] &&
    receipt.participant2Goals === input.proofStatValues[1];

  const settlementEvidenceClassification: SettlementEvidenceClassification =
    input.validationStatus !== "VERIFIED" || observationClassification !== "FINAL_MATCH_OBSERVATION"
      ? "NOT_FINAL_SETTLEMENT_EVIDENCE"
      : exactReceipt
        ? "FINAL_SETTLEMENT_VERIFIED"
        : "FINAL_DATA_VERIFIED_NO_RECEIPT";

  return { observationClassification, settlementEvidenceClassification, warnings };
}
