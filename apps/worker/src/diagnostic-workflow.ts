import { getProofVerification, persistedProof, recordProofDiagnostic } from "@predict9ja/db";
import { configFromEnvironment } from "@predict9ja/txline";
import {
  diagnoseProofReadOnly,
  solanaConfigFromEnvironment,
  type ScoreStatValidationRequest,
} from "@predict9ja/verification";
import { reuseOrFetchProof, verifyProof } from "./proof-workflow";
import { resolveValidationProvider } from "./validation-provider";

export async function runDiagnostic(input: ScoreStatValidationRequest) {
  const txline = configFromEnvironment(process.env);
  const stored = await persistedProof({
    network: txline.network,
    fixtureSourceId: input.fixtureId,
    providerSequence: input.sequence,
    statKeys: input.statKeys,
  });
  if (!stored) throw new Error("PERSISTED_PROOF_NOT_AVAILABLE");
  const one = await reuseOrFetchProof({ ...input, statKeys: [input.statKeys[0]!] });
  if (!one.ok) throw new Error(one.safeErrorCategory);
  const provider = await resolveValidationProvider();
  const result = await diagnoseProofReadOnly(
    one.proof,
    stored.proof,
    solanaConfigFromEnvironment(process.env),
    provider.keypair,
    provider.mode,
  );
  const stages = {
    stageA: result.preflight.status,
    stageB: result.legacyOneStat.status,
    stageC: result.v2OneStat.status,
    stageD: result.v2TwoStat.status,
  };
  const failures = Object.values(stages).filter(
    (value) => value !== "PASSED" && value !== "VERIFIED" && value !== "REJECTED",
  );
  await recordProofDiagnostic(stored.attempt.id, { ...result, stages }, failures.at(-1) ?? null);
  return {
    verificationId: stored.attempt.id,
    network: txline.network,
    fixtureId: input.fixtureId,
    sequence: input.sequence,
    statKeys: input.statKeys,
    statValues: stored.proof.stats.map(({ stat }) => stat.value),
    proofPayloadDigest: stored.digest,
    providerMode: provider.mode,
    ...result,
    stages,
  };
}

export async function retryDiagnostic(verificationId: string) {
  const verification = await getProofVerification(verificationId);
  if (!verification) throw new Error("VERIFICATION_NOT_FOUND");
  const keys = Array.isArray(verification.statKeys)
    ? verification.statKeys.filter((key): key is number => Number.isSafeInteger(key))
    : [];
  return verifyProof({
    fixtureId: verification.fixtureSourceId,
    sequence: verification.providerSequence,
    statKeys: keys,
  });
}
