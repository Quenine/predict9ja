import { describe, expect, it } from "vitest";
import { classifyProofEvidence } from "./proof-classification";

const observation = {
  id: "observation-962",
  fixtureId: "fixture-internal",
  fixtureSourceId: "18241006",
  providerSequence: 962,
  sourceMode: "LIVE" as const,
  action: "game_finalised",
  finalised: true,
  phase: "UNKNOWN",
  period: null,
  participant1Goals: 1,
  participant2Goals: 2,
};
const classify = (overrides = {}) =>
  classifyProofEvidence({
    proofFixtureSourceId: "18241006",
    proofSequence: 962,
    proofStatValues: [1, 2],
    validationStatus: "VERIFIED",
    observation,
    receipt: null,
    ...overrides,
  });

describe("proof evidence classification", () => {
  it("classifies explicit matching finalisation without requiring phase or period", () => {
    expect(classify()).toMatchObject({
      observationClassification: "FINAL_MATCH_OBSERVATION",
      settlementEvidenceClassification: "FINAL_DATA_VERIFIED_NO_RECEIPT",
    });
  });
  it("keeps a later unknown action in play", () => {
    expect(
      classify({
        proofSequence: 963,
        observation: { ...observation, providerSequence: 963, action: "unknown", finalised: false },
      }),
    ).toMatchObject({
      observationClassification: "IN_PLAY_OBSERVATION",
      settlementEvidenceClassification: "NOT_FINAL_SETTLEMENT_EVIDENCE",
    });
  });
  it.each([
    ["fixture mismatch", { observation: { ...observation, fixtureSourceId: "different" } }],
    ["sequence mismatch", { observation: { ...observation, providerSequence: 961 } }],
  ])("does not treat a %s as final", (_label, overrides) => {
    expect(classify(overrides).observationClassification).toBe("LOCAL_OBSERVATION_NOT_FOUND");
  });
  it.each(["REPLAY", "SYNTHETIC"] as const)(
    "rejects %s observations as final evidence",
    (sourceMode) => {
      expect(
        classify({ observation: { ...observation, sourceMode } }).observationClassification,
      ).toBe("IN_PLAY_OBSERVATION");
    },
  );
  it("reports local value mismatches", () => {
    expect(classify({ proofStatValues: [2, 1] }).observationClassification).toBe(
      "LOCAL_VALUE_MISMATCH",
    );
  });
  it("does not let UNKNOWN phase or null period override explicit finalisation", () => {
    expect(
      classify({ observation: { ...observation, phase: "UNKNOWN", period: null } })
        .observationClassification,
    ).toBe("FINAL_MATCH_OBSERVATION");
  });
  it("classifies an exact live receipt as verified settlement", () => {
    expect(
      classify({
        receipt: {
          fixtureId: observation.fixtureId,
          finalObservationId: observation.id,
          providerSequence: 962,
          sourceMode: "LIVE",
          participant1Goals: 1,
          participant2Goals: 2,
        },
      }).settlementEvidenceClassification,
    ).toBe("FINAL_SETTLEMENT_VERIFIED");
  });
  it.each([
    ["another sequence", { providerSequence: 961, sourceMode: "LIVE" as const }],
    ["synthetic", { providerSequence: 962, sourceMode: "SYNTHETIC" as const }],
  ])("does not link a receipt for %s", (_label, receiptOverride) => {
    expect(
      classify({
        receipt: {
          fixtureId: observation.fixtureId,
          finalObservationId: observation.id,
          participant1Goals: 1,
          participant2Goals: 2,
          ...receiptOverride,
        },
      }).settlementEvidenceClassification,
    ).toBe("FINAL_DATA_VERIFIED_NO_RECEIPT");
  });
});
