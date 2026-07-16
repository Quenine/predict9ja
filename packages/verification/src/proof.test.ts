import { describe, expect, it } from "vitest";
import { normalizeScoreStatProof, proofPayloadDigest, validateScoreStatRequest } from "./proof";

const hash = (byte: number): number[] => Array<number>(32).fill(byte);
const node = (byte: number, right = false) => ({ hash: hash(byte), isRightSibling: right });
const request = { fixtureId: "18241006", sequence: 626, statKeys: [1, 2] };
const raw = () => ({
  ts: Date.UTC(2026, 6, 15, 10, 2),
  summary: {
    fixtureId: 18241006,
    updateStats: {
      updateCount: 3,
      minTimestamp: Date.UTC(2026, 6, 15, 10),
      maxTimestamp: Date.UTC(2026, 6, 15, 10, 4),
    },
    eventStatsSubTreeRoot: hash(1),
  },
  subTreeProof: [node(2)],
  mainTreeProof: [node(3, true)],
  eventStatRoot: hash(4),
  statsToProve: [
    { key: 1, value: 2, period: 0 },
    { key: 2, value: 1, period: 0 },
  ],
  statProofs: [[node(5)], [node(6, true)]],
});

describe("proof request and normalization", () => {
  it("rejects seq zero, duplicate keys, key zero, and empty keys", () => {
    expect(() => validateScoreStatRequest({ ...request, sequence: 0 })).toThrow("INVALID_SEQUENCE");
    expect(() => validateScoreStatRequest({ ...request, statKeys: [1, 1] })).toThrow(
      "INVALID_STAT_KEYS",
    );
    expect(() => validateScoreStatRequest({ ...request, statKeys: [0] })).toThrow(
      "INVALID_STAT_KEYS",
    );
    expect(() => validateScoreStatRequest({ ...request, statKeys: [] })).toThrow(
      "INVALID_STAT_KEYS",
    );
  });
  it("supports base64, hex, and byte-array 32-byte hashes and preserves direction", () => {
    const input = raw();
    input.summary.eventStatsSubTreeRoot = Buffer.from(hash(1)).toString("base64") as never;
    input.eventStatRoot = Buffer.from(hash(4)).toString("hex") as never;
    const proof = normalizeScoreStatProof(input, request, "devnet");
    expect(proof.eventStatRoot).toHaveLength(32);
    expect(proof.mainTreeProof[0]?.isRightSibling).toBe(true);
  });
  it("rejects fixture, stat count, hash length, and positional mismatches", () => {
    expect(() =>
      normalizeScoreStatProof(
        { ...raw(), summary: { ...raw().summary, fixtureId: 9 } },
        request,
        "devnet",
      ),
    ).toThrow("FIXTURE_MISMATCH");
    expect(() =>
      normalizeScoreStatProof({ ...raw(), statProofs: [[node(5)]] }, request, "devnet"),
    ).toThrow("STAT_COUNT_MISMATCH");
    expect(() =>
      normalizeScoreStatProof({ ...raw(), eventStatRoot: [1, 2] }, request, "devnet"),
    ).toThrow();
    const input = raw();
    input.statsToProve[0]!.key = 2;
    expect(() => normalizeScoreStatProof(input, request, "devnet")).toThrow(
      "STAT_KEY_ORDER_MISMATCH",
    );
  });
});

describe("proof payload digest", () => {
  const proof = () => normalizeScoreStatProof(raw(), request, "devnet");
  it("is deterministic across source property ordering", () => {
    const input = raw();
    const reordered = {
      ts: input.ts,
      statProofs: input.statProofs,
      statsToProve: input.statsToProve,
      eventStatRoot: input.eventStatRoot,
      mainTreeProof: input.mainTreeProof,
      subTreeProof: input.subTreeProof,
      summary: input.summary,
    };
    expect(proofPayloadDigest(proof())).toBe(
      proofPayloadDigest(normalizeScoreStatProof(reordered, request, "devnet")),
    );
  });
  it("changes with stat-key order, one proof byte, or sibling direction", () => {
    const original = proof();
    const reversedRaw = raw();
    reversedRaw.statsToProve.reverse();
    reversedRaw.statProofs.reverse();
    const reversed = normalizeScoreStatProof(
      reversedRaw,
      { ...request, statKeys: [2, 1] },
      "devnet",
    );
    const byteChanged = raw();
    byteChanged.statProofs[0]![0]!.hash[0] = 99;
    const directionChanged = raw();
    directionChanged.statProofs[0]![0]!.isRightSibling = true;
    expect(proofPayloadDigest(reversed)).not.toBe(proofPayloadDigest(original));
    expect(proofPayloadDigest(normalizeScoreStatProof(byteChanged, request, "devnet"))).not.toBe(
      proofPayloadDigest(original),
    );
    expect(
      proofPayloadDigest(normalizeScoreStatProof(directionChanged, request, "devnet")),
    ).not.toBe(proofPayloadDigest(original));
  });
});
