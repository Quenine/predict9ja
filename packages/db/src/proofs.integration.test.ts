import { PrismaClient } from "@prisma/client";
import type { NormalizedScoreStatProof } from "@predict9ja/verification";
import { afterAll, beforeEach, describe, expect, it } from "vitest";
import {
  beginProofAttempt,
  linkProofToMatchingReceipt,
  recordFetchedProof,
  recordProofValidation,
  recordProofValidationFailure,
} from "./proofs";

const url = process.env.DATABASE_TEST_URL ?? process.env.DATABASE_URL;
if (!url || !new URL(url).pathname.toLowerCase().includes("test"))
  throw new Error("Integration tests require DATABASE_TEST_URL pointing to a test database");
const client = new PrismaClient({ datasources: { db: { url } } });
const hash = Array(32).fill(1) as number[];
const proof = (keys: readonly number[] = [1, 2], values: readonly number[] = [2, 1]) =>
  ({
    network: "devnet",
    fixtureId: "proof-fixture",
    sequence: 7,
    targetTimestamp: Date.UTC(2026, 6, 15, 0, 2),
    requestedStatKeys: keys,
    updateCount: 1,
    minTimestamp: Date.UTC(2026, 6, 15),
    maxTimestamp: Date.UTC(2026, 6, 15, 0, 4),
    eventStatsSubTreeRoot: hash,
    subTreeProof: [{ hash, isRightSibling: false }],
    mainTreeProof: [{ hash, isRightSibling: true }],
    eventStatRoot: hash,
    stats: keys.map((key, index) => ({
      stat: { key, value: values[index]!, period: 0 },
      proof: [{ hash, isRightSibling: false }],
    })),
  }) satisfies NormalizedScoreStatProof;

async function setup(finalised = false, sequence = 7) {
  const fixture = await client.fixture.create({
    data: {
      sourceId: "proof-fixture",
      sourceMode: "LIVE",
      homeTeam: "P1",
      awayTeam: "P2",
      participant1Name: "P1",
      participant2Name: "P2",
      participant1IsHome: true,
      startsAt: new Date(),
      status: "UNKNOWN",
    },
  });
  const observation = await client.scoreObservation.create({
    data: {
      fixtureId: fixture.id,
      providerSequence: sequence,
      providerTimestamp: new Date(),
      action: finalised ? "game_finalised" : "score_update",
      phase: finalised ? "UNKNOWN" : "SECOND_HALF",
      period: null,
      participant1Goals: 2,
      participant2Goals: 1,
      finalised,
      sourceMode: "LIVE",
    },
  });
  return { fixture, observation };
}
beforeEach(async () => {
  await client.$executeRawUnsafe(
    'TRUNCATE TABLE "ScoreProofVerification", "ResolutionReceipt", "ScoreObservation", "FixtureScoreProjection", "ReplayScoreState", "MarketOutcome", "Market", "Fixture" RESTART IDENTITY CASCADE',
  );
});
afterAll(() => client.$disconnect());

describe("proof verification persistence", () => {
  it("creates then reuses an attempt while preserving ordered-key identity", async () => {
    await setup();
    const input = {
      network: "devnet" as const,
      fixtureSourceId: "proof-fixture",
      providerSequence: 7,
      statKeys: [1, 2],
    };
    const first = await beginProofAttempt(input, client);
    const retry = await beginProofAttempt(input, client);
    const reversed = await beginProofAttempt({ ...input, statKeys: [2, 1] }, client);
    expect(retry.id).toBe(first.id);
    expect(reversed.id).not.toBe(first.id);
  });
  it("stops validation on local value mismatch", async () => {
    await setup();
    const result = await recordFetchedProof(proof([1, 2], [9, 1]), "a".repeat(64), client);
    expect(result.localValueMismatch).toBe(true);
    expect(result.attempt).toMatchObject({
      validationStatus: "NOT_REQUESTED",
      safeFailureCategory: "LOCAL_VALUE_MISMATCH",
    });
  });
  it("persists success and supports retry after RPC failure", async () => {
    await setup();
    const fetched = await recordFetchedProof(proof(), "b".repeat(64), client);
    await recordProofValidationFailure(fetched.attempt.id, "RPC_UNAVAILABLE", client);
    const result = await recordProofValidation(
      fetched.attempt.id,
      {
        status: "VERIFIED",
        programId: "program",
        dailyScoresPda: "pda",
        epochDay: 20_000,
        predicates: [],
      },
      client,
    );
    expect(result.attempt.validationStatus).toBe("VERIFIED");
    expect(result.classification).toBe("IN_PLAY_OBSERVATION");
    expect(result.settlementEvidenceClassification).toBe("NOT_FINAL_SETTLEMENT_EVIDENCE");
  });
  it("does not classify in-play proof as final settlement", async () => {
    await setup();
    const fetched = await recordFetchedProof(proof(), "c".repeat(64), client);
    const result = await recordProofValidation(
      fetched.attempt.id,
      {
        status: "VERIFIED",
        programId: "program",
        dailyScoresPda: "pda",
        epochDay: 20_000,
        predicates: [],
      },
      client,
    );
    expect(result.classification).toBe("IN_PLAY_OBSERVATION");
  });
  it("links only matching game_finalised evidence to a receipt", async () => {
    const { fixture, observation } = await setup(true);
    const market = await client.market.create({
      data: {
        fixtureId: fixture.id,
        type: "MATCH_RESULT",
        title: "Proof market",
        status: "RESOLVED",
        closeAt: new Date(),
        ruleVersion: "match-result@1",
      },
    });
    const receipt = await client.resolutionReceipt.create({
      data: {
        marketId: market.id,
        fixtureId: fixture.id,
        finalObservationId: observation.id,
        providerSequence: 7,
        sourceMode: "LIVE",
        participant1Goals: 2,
        participant2Goals: 1,
      },
    });
    const fetched = await recordFetchedProof(proof(), "d".repeat(64), client);
    await recordProofValidation(
      fetched.attempt.id,
      {
        status: "VERIFIED",
        programId: "program",
        dailyScoresPda: "pda",
        epochDay: 20_000,
        predicates: [],
      },
      client,
    );
    await expect(
      linkProofToMatchingReceipt(fetched.attempt.id, receipt.id, client),
    ).resolves.toBeTruthy();
    const linked = await client.scoreProofVerification.findUniqueOrThrow({
      where: { id: fetched.attempt.id },
    });
    expect(linked.observationClassification).toBe("FINAL_MATCH_OBSERVATION");
    expect(linked.settlementEvidenceClassification).toBe("FINAL_SETTLEMENT_VERIFIED");
    await client.resolutionReceipt.update({
      where: { id: receipt.id },
      data: { proofVerificationId: null, providerSequence: 8 },
    });
    await expect(
      linkProofToMatchingReceipt(fetched.attempt.id, receipt.id, client),
    ).rejects.toThrow("PROOF_RECEIPT_MISMATCH");
  });
  it("refreshes the existing verification identity without replacing verifiedAt", async () => {
    await setup(true);
    const fetched = await recordFetchedProof(proof(), "f".repeat(64), client);
    const validation = {
      status: "VERIFIED" as const,
      programId: "program",
      dailyScoresPda: "pda",
      epochDay: 20_000,
      predicates: [],
    };
    const first = await recordProofValidation(fetched.attempt.id, validation, client);
    const second = await recordProofValidation(fetched.attempt.id, validation, client);
    expect(second.attempt.id).toBe(first.attempt.id);
    expect(second.attempt.verifiedAt).toEqual(first.attempt.verifiedAt);
    expect(second.observationClassification).toBe("FINAL_MATCH_OBSERVATION");
    expect(second.settlementEvidenceClassification).toBe("FINAL_DATA_VERIFIED_NO_RECEIPT");
    expect(await client.scoreProofVerification.count()).toBe(1);
  });
  it("stores no supplied credential material", async () => {
    await setup();
    await recordFetchedProof(proof(), "e".repeat(64), client);
    const stored = JSON.stringify(await client.scoreProofVerification.findMany());
    expect(stored).not.toContain("api-secret");
    expect(stored).not.toContain("guest-secret");
    expect(stored).not.toContain("private-key");
  });
});
