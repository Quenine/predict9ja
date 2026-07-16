import { createHash } from "node:crypto";
import { z } from "zod";
import type { VerificationNetwork } from "./config";

const MAX_PROOF_NODES = 64;
const MIN_TIMESTAMP = Date.UTC(2000, 0, 1);
const MAX_TIMESTAMP = Date.UTC(2100, 11, 31, 23, 59, 59, 999);
const i32 = z.number().int().min(-2_147_483_648).max(2_147_483_647);
const timestamp = z.number().int().safe().min(MIN_TIMESTAMP).max(MAX_TIMESTAMP);
const encodedHash = z.union([
  z.string().min(1).max(128),
  z.array(z.number().int().min(0).max(255)).length(32),
]);
const proofNode = z.object({ hash: encodedHash, isRightSibling: z.boolean() }).strict();
const proofArray = z.array(proofNode).max(MAX_PROOF_NODES);
const scoreStat = z.object({ key: z.number().int().positive(), value: i32, period: i32 }).strict();
const rawProof = z
  .object({
    ts: timestamp,
    summary: z
      .object({
        fixtureId: z.union([z.string(), z.number()]),
        updateStats: z
          .object({
            updateCount: z.number().int().min(1),
            minTimestamp: timestamp,
            maxTimestamp: timestamp,
          })
          .strict(),
        eventStatsSubTreeRoot: encodedHash,
      })
      .strict(),
    subTreeProof: proofArray.min(1),
    mainTreeProof: proofArray.min(1),
    eventStatRoot: encodedHash,
    statsToProve: z.array(scoreStat).min(1).max(8),
    statProofs: z.array(proofArray.min(1)).min(1).max(8),
  })
  .strict();

export type ProofNode = Readonly<{ hash: readonly number[]; isRightSibling: boolean }>;
export type NormalizedStat = Readonly<{ key: number; value: number; period: number }>;
export type NormalizedScoreStatProof = Readonly<{
  network: VerificationNetwork;
  fixtureId: string;
  sequence: number;
  targetTimestamp: number;
  requestedStatKeys: readonly number[];
  updateCount: number;
  minTimestamp: number;
  maxTimestamp: number;
  eventStatsSubTreeRoot: readonly number[];
  subTreeProof: readonly ProofNode[];
  mainTreeProof: readonly ProofNode[];
  eventStatRoot: readonly number[];
  stats: readonly Readonly<{ stat: NormalizedStat; proof: readonly ProofNode[] }>[];
}>;

export type ScoreStatValidationRequest = Readonly<{
  fixtureId: string;
  sequence: number;
  statKeys: readonly number[];
}>;

export function validateScoreStatRequest(
  input: ScoreStatValidationRequest,
): ScoreStatValidationRequest {
  if (!/^[1-9]\d*$/.test(input.fixtureId) || !Number.isSafeInteger(Number(input.fixtureId)))
    throw new Error("INVALID_FIXTURE_ID");
  if (!Number.isSafeInteger(input.sequence) || input.sequence < 1)
    throw new Error("INVALID_SEQUENCE");
  if (
    input.statKeys.length < 1 ||
    input.statKeys.length > 8 ||
    input.statKeys.some((key) => !Number.isSafeInteger(key) || key < 1) ||
    new Set(input.statKeys).size !== input.statKeys.length
  )
    throw new Error("INVALID_STAT_KEYS");
  return input;
}

function decodeHash(value: z.infer<typeof encodedHash>): readonly number[] {
  if (Array.isArray(value)) return [...value];
  const text = value.trim();
  let bytes: Buffer;
  if (/^(?:0x)?[0-9a-fA-F]{64}$/.test(text))
    bytes = Buffer.from(text.startsWith("0x") ? text.slice(2) : text, "hex");
  else {
    if (!/^[A-Za-z0-9+/]+={0,2}$/.test(text) || text.length % 4 !== 0)
      throw new Error("INVALID_PROOF_HASH");
    bytes = Buffer.from(text, "base64");
  }
  if (bytes.length !== 32) throw new Error("INVALID_PROOF_HASH");
  return [...bytes];
}
const nodeOf = (node: z.infer<typeof proofNode>): ProofNode => ({
  hash: decodeHash(node.hash),
  isRightSibling: node.isRightSibling,
});
function fixtureIdOf(value: string | number): string {
  const id = String(value);
  if (!/^[1-9]\d*$/.test(id) || !Number.isSafeInteger(Number(id)))
    throw new Error("INVALID_FIXTURE_ID");
  return id;
}

export function normalizeScoreStatProof(
  payload: unknown,
  request: ScoreStatValidationRequest,
  network: VerificationNetwork,
): NormalizedScoreStatProof {
  validateScoreStatRequest(request);
  const value = rawProof.parse(payload);
  const fixtureId = fixtureIdOf(value.summary.fixtureId);
  if (fixtureId !== request.fixtureId) throw new Error("FIXTURE_MISMATCH");
  if (
    value.statsToProve.length !== value.statProofs.length ||
    value.statsToProve.length !== request.statKeys.length
  )
    throw new Error("STAT_COUNT_MISMATCH");
  if (value.summary.updateStats.minTimestamp > value.summary.updateStats.maxTimestamp)
    throw new Error("INVALID_TIMESTAMP_RANGE");
  value.statsToProve.forEach((stat, index) => {
    if (stat.key !== request.statKeys[index]) throw new Error("STAT_KEY_ORDER_MISMATCH");
  });
  return {
    network,
    fixtureId,
    sequence: request.sequence,
    targetTimestamp: value.ts,
    requestedStatKeys: [...request.statKeys],
    updateCount: value.summary.updateStats.updateCount,
    minTimestamp: value.summary.updateStats.minTimestamp,
    maxTimestamp: value.summary.updateStats.maxTimestamp,
    eventStatsSubTreeRoot: decodeHash(value.summary.eventStatsSubTreeRoot),
    subTreeProof: value.subTreeProof.map(nodeOf),
    mainTreeProof: value.mainTreeProof.map(nodeOf),
    eventStatRoot: decodeHash(value.eventStatRoot),
    stats: value.statsToProve.map((stat, index) => ({
      stat,
      proof: value.statProofs[index]!.map(nodeOf),
    })),
  };
}

const hex = (bytes: readonly number[]) => Buffer.from(bytes).toString("hex");
export function canonicalProofPayload(proof: NormalizedScoreStatProof): string {
  return JSON.stringify({
    network: proof.network,
    fixtureId: proof.fixtureId,
    sequence: proof.sequence,
    targetTimestamp: proof.targetTimestamp,
    requestedStatKeys: proof.requestedStatKeys,
    statValues: proof.stats.map(({ stat }) => stat.value),
    updateCount: proof.updateCount,
    minTimestamp: proof.minTimestamp,
    maxTimestamp: proof.maxTimestamp,
    eventStatsSubTreeRoot: hex(proof.eventStatsSubTreeRoot),
    subTreeProof: proof.subTreeProof.map((node) => [hex(node.hash), node.isRightSibling]),
    mainTreeProof: proof.mainTreeProof.map((node) => [hex(node.hash), node.isRightSibling]),
    eventStatRoot: hex(proof.eventStatRoot),
    stats: proof.stats.map(({ stat, proof: nodes }) => ({
      key: stat.key,
      value: stat.value,
      period: stat.period,
      proof: nodes.map((node) => [hex(node.hash), node.isRightSibling]),
    })),
  });
}
export function proofPayloadDigest(proof: NormalizedScoreStatProof): string {
  return createHash("sha256").update(canonicalProofPayload(proof)).digest("hex");
}
