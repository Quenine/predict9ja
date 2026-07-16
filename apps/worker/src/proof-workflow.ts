import {
  beginProofAttempt,
  latestLiveScoreObservation,
  markProofVerifying,
  persistedProof,
  recordFetchedProof,
  recordProofFetchFailure,
  recordProofDiagnostic,
  recordProofValidation,
  recordProofValidationFailure,
  refreshProofClassification,
} from "@predict9ja/db";
import {
  configFromEnvironment,
  createHttpTxlineClient,
  TxlineMalformedResponseError,
  TxlineProofResponseError,
  TxlineRequestTimeoutError,
} from "@predict9ja/txline";
import {
  executeSharedV2,
  proofPayloadDigest,
  solanaConfigFromEnvironment,
  validateScoreStatRequest,
  type ScoreStatValidationRequest,
  type SolanaFailureCategory,
} from "@predict9ja/verification";
import { resolveValidationProvider } from "./validation-provider";

export function parseStatKeys(value: string): readonly number[] {
  if (!value.trim()) throw new Error("INVALID_STAT_KEYS");
  const keys = value.split(/[\s,]+/).map((key) => Number(key));
  validateScoreStatRequest({ fixtureId: "1", sequence: 1, statKeys: keys });
  return keys;
}
export function statKeysFromArguments(): readonly number[] {
  const index = process.argv.indexOf("--stat-keys");
  if (index < 0) throw new Error("--stat-keys is required");
  const values: string[] = [];
  for (let cursor = index + 1; cursor < process.argv.length; cursor++) {
    const value = process.argv[cursor]!;
    if (value.startsWith("--")) break;
    values.push(value);
  }
  return parseStatKeys(values.join(","));
}

export async function fetchProof(input: ScoreStatValidationRequest) {
  const config = configFromEnvironment(process.env);
  const attempt = await beginProofAttempt({
    network: config.network,
    fixtureSourceId: input.fixtureId,
    providerSequence: input.sequence,
    statKeys: input.statKeys,
  });
  try {
    const proof = await createHttpTxlineClient(config).getScoreStatValidation(input);
    const digest = proofPayloadDigest(proof);
    const persisted = await recordFetchedProof(proof, digest);
    return {
      ok: true as const,
      proof,
      digest,
      attempt: persisted.attempt,
      localValueMismatch: persisted.localValueMismatch,
    };
  } catch (error) {
    if (error instanceof TxlineRequestTimeoutError) {
      await recordProofFetchFailure(attempt.id, "FAILED", error.code);
      return {
        ok: false as const,
        fixtureId: input.fixtureId,
        sequence: input.sequence,
        statKeys: input.statKeys,
        fetchStatus: "FAILED" as const,
        safeErrorCategory: error.code,
        endpointCategory: error.endpointCategory,
      };
    }
    const malformed =
      error instanceof TxlineMalformedResponseError || error instanceof TxlineProofResponseError;
    const category =
      error instanceof TxlineProofResponseError ? error.category : "MALFORMED_RESPONSE";
    await recordProofFetchFailure(
      attempt.id,
      malformed ? "MALFORMED" : "FAILED",
      malformed ? category : "PROVIDER_REQUEST_FAILED",
    );
    return {
      ok: false as const,
      fixtureId: input.fixtureId,
      sequence: input.sequence,
      statKeys: input.statKeys,
      fetchStatus: malformed ? ("MALFORMED" as const) : ("FAILED" as const),
      safeErrorCategory: malformed ? category : "PROVIDER_REQUEST_FAILED",
    };
  }
}

export async function reuseOrFetchProof(input: ScoreStatValidationRequest) {
  const config = configFromEnvironment(process.env);
  const stored = await persistedProof({
    network: config.network,
    fixtureSourceId: input.fixtureId,
    providerSequence: input.sequence,
    statKeys: input.statKeys,
  });
  if (stored)
    return {
      ok: true as const,
      proof: stored.proof,
      digest: stored.digest,
      attempt: stored.attempt,
      localValueMismatch: stored.attempt.safeFailureCategory === "LOCAL_VALUE_MISMATCH",
      reused: true as const,
    };
  return { ...(await fetchProof(input)), reused: false as const };
}

export async function verifyProof(input: ScoreStatValidationRequest) {
  const fetched = await reuseOrFetchProof(input);
  if (!fetched.ok) return fetched;
  const currentClassification = await refreshProofClassification(fetched.attempt.id);
  if (currentClassification.observationClassification === "LOCAL_VALUE_MISMATCH")
    return {
      ok: false as const,
      fixtureId: input.fixtureId,
      sequence: input.sequence,
      statKeys: input.statKeys,
      digest: fetched.digest,
      fetchStatus: "FETCHED" as const,
      validationStatus: "NOT_REQUESTED" as const,
      safeErrorCategory: "LOCAL_VALUE_MISMATCH",
      observationClassification: currentClassification.observationClassification,
      settlementEvidenceClassification: currentClassification.settlementEvidenceClassification,
    };
  if (fetched.attempt.validationStatus === "VERIFIED") {
    const predicates = fetched.proof.stats.map(({ stat }, index) => ({
      index,
      statKey: stat.key,
      comparison: "EQUAL_TO" as const,
      threshold: stat.value,
    }));
    return {
      ok: true as const,
      verificationId: fetched.attempt.id,
      providerMode: fetched.attempt.providerMode ?? "EPHEMERAL",
      proof: fetched.proof,
      digest: fetched.digest,
      result: {
        status: "VERIFIED" as const,
        programId: fetched.attempt.programId ?? "",
        dailyScoresPda: fetched.attempt.dailyScoresPda ?? "",
        epochDay: fetched.attempt.epochDay ?? 0,
        predicates,
      },
      preflightStatus: "PASSED" as const,
      classification: currentClassification.observationClassification,
      settlementEvidenceClassification: currentClassification.settlementEvidenceClassification,
    };
  }
  await markProofVerifying(fetched.attempt.id);
  const solana = solanaConfigFromEnvironment(process.env);
  const classification = currentClassification.observationClassification;
  const settlementClassification = currentClassification.settlementEvidenceClassification;
  let provider;
  try {
    provider = await resolveValidationProvider();
  } catch (error) {
    const category =
      error instanceof Error && error.message === "DIAGNOSTIC_WALLET_GUARD_REQUIRED"
        ? error.message
        : "VALIDATION_PROVIDER_FAILED";
    await recordProofDiagnostic(
      fetched.attempt.id,
      { providerMode: "EPHEMERAL", preflightStatus: "NOT_RUN", validationStatus: "NOT_RUN" },
      category,
      "EPHEMERAL",
    );
    return {
      ok: false as const,
      verificationId: fetched.attempt.id,
      providerMode: "EPHEMERAL" as const,
      fixtureId: input.fixtureId,
      sequence: input.sequence,
      statKeys: input.statKeys,
      statValues: fetched.proof.stats.map(({ stat }) => stat.value),
      digest: fetched.digest,
      preflightStatus: "NOT_RUN" as const,
      validationStatus: "FAILED" as const,
      observationClassification: classification,
      settlementEvidenceClassification: settlementClassification,
      safeErrorCategory: category,
    };
  }
  const shared = await executeSharedV2(fetched.proof, solana, provider.keypair, provider.mode);
  const diagnostic = {
    providerMode: provider.mode,
    preflight: shared.preflight,
    v2TwoStat: shared.validation,
  };
  if (shared.validation.status === "VERIFIED") {
    await recordProofDiagnostic(fetched.attempt.id, diagnostic, null, provider.mode);
    const result = {
      status: "VERIFIED" as const,
      programId: shared.programId,
      dailyScoresPda: shared.dailyScoresPda,
      epochDay: shared.epochDay,
      predicates: shared.predicates,
    };
    const persisted = await recordProofValidation(fetched.attempt.id, result);
    return {
      ok: true as const,
      verificationId: fetched.attempt.id,
      providerMode: provider.mode,
      proof: fetched.proof,
      digest: fetched.digest,
      result,
      preflightStatus: shared.preflight.status,
      classification: persisted.classification,
      settlementEvidenceClassification: persisted.settlementEvidenceClassification,
    };
  }
  const category: SolanaFailureCategory =
    shared.validation.status === "REJECTED"
      ? "PREDICATE_REJECTION"
      : shared.validation.status === "NOT_RUN"
        ? "UNKNOWN_PROGRAM_FAILURE"
        : shared.validation.status;
  await recordProofDiagnostic(fetched.attempt.id, diagnostic, category, provider.mode);
  await recordProofValidationFailure(fetched.attempt.id, category);
  return {
    ok: false as const,
    verificationId: fetched.attempt.id,
    providerMode: provider.mode,
    fixtureId: input.fixtureId,
    sequence: input.sequence,
    statKeys: input.statKeys,
    statValues: fetched.proof.stats.map(({ stat }) => stat.value),
    digest: fetched.digest,
    programId: shared.programId,
    dailyScoresPda: shared.dailyScoresPda,
    exactPredicates: shared.predicates,
    preflightStatus: shared.preflight.status,
    observationClassification: classification,
    settlementEvidenceClassification: settlementClassification,
    fetchStatus: "FETCHED" as const,
    validationStatus: "FAILED" as const,
    safeErrorCategory: category,
    logs: shared.validation.logs,
  };
}

export async function latestProofInput(fixtureId: string): Promise<ScoreStatValidationRequest> {
  const observation = await latestLiveScoreObservation(fixtureId);
  if (!observation) throw new Error("NO_LIVE_SCORE_OBSERVATION");
  return { fixtureId, sequence: observation.providerSequence, statKeys: [1, 2] };
}

export function safeFetchSummary(result: Awaited<ReturnType<typeof fetchProof>>) {
  if (!result.ok) return result;
  return {
    network: result.proof.network,
    fixtureId: result.proof.fixtureId,
    sequence: result.proof.sequence,
    statKeys: result.proof.requestedStatKeys,
    statValues: result.proof.stats.map(({ stat }) => stat.value),
    targetTimestamp: new Date(result.proof.targetTimestamp).toISOString(),
    proofNodeCounts: {
      fixture: result.proof.subTreeProof.length,
      main: result.proof.mainTreeProof.length,
      stats: result.proof.stats.map(({ proof }) => proof.length),
    },
    proofPayloadDigest: result.digest,
    fetchStatus: "FETCHED",
  };
}

export function safeVerificationSummary(result: Awaited<ReturnType<typeof verifyProof>>) {
  if (!result.ok) return result;
  return {
    ok: true,
    verificationId: result.verificationId,
    providerMode: result.providerMode,
    network: result.proof.network,
    fixtureId: result.proof.fixtureId,
    sequence: result.proof.sequence,
    statKeys: result.proof.requestedStatKeys,
    statValues: result.proof.stats.map(({ stat }) => stat.value),
    proofPayloadDigest: result.digest,
    programId: result.result.programId,
    dailyScoresPda: result.result.dailyScoresPda,
    exactPredicates: result.result.predicates,
    validationStatus: result.result.status,
    preflightStatus: result.preflightStatus,
    observationClassification: result.classification,
    settlementEvidenceClassification: result.settlementEvidenceClassification,
  };
}
