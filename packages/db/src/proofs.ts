import type { Prisma, PrismaClient } from "@prisma/client";
import type {
  NormalizedScoreStatProof,
  SolanaFailureCategory,
  SolanaValidationResult,
  VerificationNetwork,
} from "@predict9ja/verification";
import { db } from "./index";
import {
  classifyProofEvidence,
  type ObservationClassification,
  type SettlementEvidenceClassification,
} from "./proof-classification";

export const statKeyIdentity = (keys: readonly number[]) => keys.join(",");
export type { ObservationClassification, SettlementEvidenceClassification };

const proofValues = (value: unknown): readonly number[] =>
  Array.isArray(value) && value.every((item) => typeof item === "number") ? value : [];

export async function refreshProofClassification(id: string, client: PrismaClient = db) {
  const verification = await client.scoreProofVerification.findUniqueOrThrow({
    where: { id },
    include: { scoreObservation: { include: { fixture: true } }, receipt: true },
  });
  const observation = verification.scoreObservation;
  const classification = classifyProofEvidence({
    proofFixtureSourceId: verification.fixtureSourceId,
    proofSequence: verification.providerSequence,
    proofStatValues: proofValues(verification.statValues),
    validationStatus: verification.validationStatus,
    observation: observation
      ? {
          ...observation,
          fixtureSourceId: observation.fixture.sourceId,
        }
      : null,
    receipt: verification.receipt,
  });
  const attempt = await client.scoreProofVerification.update({
    where: { id },
    data: {
      observationClassification: classification.observationClassification,
      settlementEvidenceClassification: classification.settlementEvidenceClassification,
      classificationWarnings: classification.warnings,
    },
    include: { scoreObservation: true, receipt: true },
  });
  return { attempt, ...classification };
}

export async function latestLiveScoreObservation(
  fixtureSourceId: string,
  client: PrismaClient = db,
) {
  return client.scoreObservation.findFirst({
    where: {
      fixture: { sourceId: fixtureSourceId },
      sourceMode: "LIVE",
      providerSequence: { gte: 1 },
    },
    orderBy: { providerSequence: "desc" },
    include: { fixture: true },
  });
}

export async function beginProofAttempt(
  input: Readonly<{
    network: VerificationNetwork;
    fixtureSourceId: string;
    providerSequence: number;
    statKeys: readonly number[];
  }>,
  client: PrismaClient = db,
) {
  const fixture = await client.fixture.findUniqueOrThrow({
    where: { sourceId: input.fixtureSourceId },
  });
  const observation = await client.scoreObservation.findUnique({
    where: {
      fixtureId_providerSequence: {
        fixtureId: fixture.id,
        providerSequence: input.providerSequence,
      },
    },
  });
  const identity = statKeyIdentity(input.statKeys);
  return client.scoreProofVerification.upsert({
    where: {
      network_fixtureSourceId_providerSequence_statKeyIdentity: {
        network: input.network,
        fixtureSourceId: input.fixtureSourceId,
        providerSequence: input.providerSequence,
        statKeyIdentity: identity,
      },
    },
    create: {
      fixtureId: fixture.id,
      scoreObservationId: observation?.sourceMode === "LIVE" ? observation.id : null,
      fixtureSourceId: input.fixtureSourceId,
      providerSequence: input.providerSequence,
      network: input.network,
      statKeys: [...input.statKeys],
      statKeyIdentity: identity,
      fetchStatus: "FETCHING",
      validationStatus: "NOT_REQUESTED",
    },
    update: {
      scoreObservationId: observation?.sourceMode === "LIVE" ? observation.id : null,
      fetchStatus: "FETCHING",
      safeFailureCategory: null,
    },
  });
}

export async function persistedProof(
  input: Readonly<{
    network: VerificationNetwork;
    fixtureSourceId: string;
    providerSequence: number;
    statKeys: readonly number[];
  }>,
  client: PrismaClient = db,
) {
  const attempt = await client.scoreProofVerification.findUnique({
    where: {
      network_fixtureSourceId_providerSequence_statKeyIdentity: {
        network: input.network,
        fixtureSourceId: input.fixtureSourceId,
        providerSequence: input.providerSequence,
        statKeyIdentity: statKeyIdentity(input.statKeys),
      },
    },
    include: { scoreObservation: true },
  });
  if (!attempt?.normalizedProof || !attempt.proofPayloadDigest) return null;
  return {
    attempt,
    proof: attempt.normalizedProof as unknown as NormalizedScoreStatProof,
    digest: attempt.proofPayloadDigest,
  };
}

export async function recordFetchedProof(
  proof: NormalizedScoreStatProof,
  digest: string,
  client: PrismaClient = db,
) {
  const attempt = await beginProofAttempt(
    {
      network: proof.network,
      fixtureSourceId: proof.fixtureId,
      providerSequence: proof.sequence,
      statKeys: proof.requestedStatKeys,
    },
    client,
  );
  const observation = attempt.scoreObservationId
    ? await client.scoreObservation.findUnique({ where: { id: attempt.scoreObservationId } })
    : null;
  const values = proof.stats.map(({ stat }) => stat.value);
  const mismatch = observation
    ? observation.sourceMode !== "LIVE" ||
      observation.participant1Goals !== values[0] ||
      observation.participant2Goals !== values[1]
    : false;
  const updated = await client.scoreProofVerification.update({
    where: { id: attempt.id },
    data: {
      statValues: values,
      targetTimestamp: new Date(proof.targetTimestamp),
      proofPayloadDigest: digest,
      normalizedProof: JSON.parse(JSON.stringify(proof)) as Prisma.InputJsonValue,
      fetchStatus: "FETCHED",
      fetchedAt: new Date(),
      validationStatus: "NOT_REQUESTED",
      safeFailureCategory: mismatch ? "LOCAL_VALUE_MISMATCH" : null,
    },
    include: { scoreObservation: true },
  });
  return { attempt: updated, localValueMismatch: mismatch };
}

export async function recordProofDiagnostic(
  id: string,
  summary: unknown,
  category: string | null,
  providerMode?: string,
  client: PrismaClient = db,
) {
  const current = await client.scoreProofVerification.findUniqueOrThrow({ where: { id } });
  const previous = Array.isArray(current.validationHistory) ? current.validationHistory : [];
  const safeSummary = JSON.parse(JSON.stringify(summary)) as Prisma.InputJsonValue;
  const history = [...previous.slice(-9), { at: new Date().toISOString(), summary: safeSummary }];
  const isVerified = (candidate: unknown) => {
    if (typeof candidate !== "object" || candidate === null) return false;
    const record = candidate as Record<string, unknown>;
    const v2 =
      typeof record.v2TwoStat === "object" && record.v2TwoStat !== null
        ? (record.v2TwoStat as Record<string, unknown>)
        : null;
    const stages =
      typeof record.stages === "object" && record.stages !== null
        ? (record.stages as Record<string, unknown>)
        : null;
    return v2?.status === "VERIFIED" || stages?.stageD === "VERIFIED";
  };
  const preserveAuthoritative = isVerified(current.diagnosticSummary) && !isVerified(safeSummary);
  return client.scoreProofVerification.update({
    where: { id },
    data: {
      ...(preserveAuthoritative ? {} : { diagnosticSummary: safeSummary }),
      validationHistory: history,
      retryCount: { increment: 1 },
      safeFailureCategory: current.validationStatus === "VERIFIED" && category ? null : category,
      ...(providerMode && !preserveAuthoritative ? { providerMode } : {}),
    },
  });
}

export async function recordProofFetchFailure(
  id: string,
  status: "UNAVAILABLE" | "MALFORMED" | "FAILED",
  category: string,
  client: PrismaClient = db,
) {
  return client.scoreProofVerification.update({
    where: { id },
    data: { fetchStatus: status, safeFailureCategory: category },
  });
}

export async function markProofVerifying(id: string, client: PrismaClient = db) {
  return client.scoreProofVerification.update({
    where: { id },
    data: {
      validationStatus: "VERIFYING",
      validationStrategy: "EXACT_EQUALITY_TWO_STATS_V1",
      safeFailureCategory: null,
    },
  });
}

export async function recordProofValidation(
  id: string,
  result: SolanaValidationResult,
  client: PrismaClient = db,
) {
  const current = await client.scoreProofVerification.findUniqueOrThrow({ where: { id } });
  await client.scoreProofVerification.update({
    where: { id },
    data: {
      validationStatus: result.status,
      validationStrategy: "EXACT_EQUALITY_TWO_STATS_V1",
      programId: result.programId,
      dailyScoresPda: result.dailyScoresPda,
      epochDay: result.epochDay,
      verifiedAt:
        result.status === "VERIFIED" ? (current.verifiedAt ?? new Date()) : current.verifiedAt,
      safeFailureCategory: result.status === "REJECTED" ? "PROOF_REJECTED" : null,
    },
  });
  const refreshed = await refreshProofClassification(id, client);
  return {
    ...refreshed,
    classification: refreshed.observationClassification,
  };
}

const validationStatusFor = (category: SolanaFailureCategory) =>
  category === "RPC_UNAVAILABLE"
    ? "RPC_UNAVAILABLE"
    : category === "RPC_NOT_DEVNET"
      ? "NETWORK_MISMATCH"
      : category === "PROGRAM_ID_MISMATCH" || category === "IDL_PROGRAM_MISMATCH"
        ? "PROGRAM_MISMATCH"
        : "FAILED";
export async function recordProofValidationFailure(
  id: string,
  category: SolanaFailureCategory,
  client: PrismaClient = db,
) {
  return client.scoreProofVerification.update({
    where: { id },
    data: {
      validationStatus: validationStatusFor(category),
      safeFailureCategory: category,
    },
  });
}

export async function linkProofToMatchingReceipt(
  verificationId: string,
  receiptId: string,
  client: PrismaClient = db,
) {
  const verification = await client.scoreProofVerification.findUniqueOrThrow({
    where: { id: verificationId },
    include: { scoreObservation: { include: { fixture: true } } },
  });
  const receipt = await client.resolutionReceipt.findUniqueOrThrow({ where: { id: receiptId } });
  const observation = verification.scoreObservation;
  const classification = classifyProofEvidence({
    proofFixtureSourceId: verification.fixtureSourceId,
    proofSequence: verification.providerSequence,
    proofStatValues: proofValues(verification.statValues),
    validationStatus: verification.validationStatus,
    observation: observation
      ? { ...observation, fixtureSourceId: observation.fixture.sourceId }
      : null,
    receipt,
  });
  if (classification.settlementEvidenceClassification !== "FINAL_SETTLEMENT_VERIFIED")
    throw new Error("PROOF_RECEIPT_MISMATCH");
  const linked = await client.resolutionReceipt.update({
    where: { id: receiptId },
    data: { proofVerificationId: verificationId },
  });
  await refreshProofClassification(verificationId, client);
  return linked;
}

export function getProofVerification(id: string, client: PrismaClient = db) {
  return client.scoreProofVerification.findUnique({
    where: { id },
    include: { fixture: true, scoreObservation: true, receipt: true },
  });
}
