import { describe, expect, it, vi } from "vitest";
import type { NormalizedScoreStatProof } from "./proof";
import {
  epochDayOf,
  epochDaySeed,
  exactEqualityPredicates,
  SolanaValidationError,
  validateStatV2ReadOnly,
} from "./solana";

const hash = Array(32).fill(1) as number[];
const proof: NormalizedScoreStatProof = {
  network: "devnet",
  fixtureId: "18241006",
  sequence: 626,
  targetTimestamp: Date.UTC(2026, 6, 15, 0, 2),
  requestedStatKeys: [1, 2],
  updateCount: 1,
  minTimestamp: Date.UTC(2026, 6, 15),
  maxTimestamp: Date.UTC(2026, 6, 15, 0, 4),
  eventStatsSubTreeRoot: hash,
  subTreeProof: [{ hash, isRightSibling: false }],
  mainTreeProof: [{ hash, isRightSibling: true }],
  eventStatRoot: hash,
  stats: [
    { stat: { key: 1, value: 3, period: 0 }, proof: [{ hash, isRightSibling: false }] },
    { stat: { key: 2, value: 2, period: 0 }, proof: [{ hash, isRightSibling: true }] },
  ],
};
const config = {
  network: "devnet" as const,
  rpcUrl: "https://api.devnet.solana.com",
  commitment: "confirmed" as const,
  timeoutMs: 1_000,
  programId: "6pW64gN1s2uqjHkn1unFeEjAwJkPGHoppGvS715wyP2J",
};
const call = (result: boolean) => ({
  genesisHash: vi.fn(() => Promise.resolve("EtWTRABZaYq6iMfeYKouRu166VU2xqa1wcaWoxPkrZBG")),
  validate: vi.fn(() => Promise.resolve(result)),
  diagnose: vi.fn(() => Promise.resolve([])),
  accountOwner: vi.fn(() => Promise.resolve(config.programId)),
});

describe("Solana read-only validation", () => {
  it("derives epoch day and u16 little-endian seed", () => {
    const day = epochDayOf(proof.minTimestamp);
    expect(epochDaySeed(day).readUInt16LE()).toBe(day);
  });
  it("covers exactly two ordered stats with provider equality values", () => {
    expect(exactEqualityPredicates(proof)).toEqual([
      { index: 0, statKey: 1, comparison: "EQUAL_TO", threshold: 3 },
      { index: 1, statKey: 2, comparison: "EQUAL_TO", threshold: 2 },
    ]);
  });
  it("maps view true to VERIFIED and false to REJECTED", async () => {
    await expect(validateStatV2ReadOnly(proof, config, call(true))).resolves.toMatchObject({
      status: "VERIFIED",
    });
    await expect(validateStatV2ReadOnly(proof, config, call(false))).resolves.toMatchObject({
      status: "REJECTED",
    });
  });
  it("enforces proof network and official IDL program before RPC", async () => {
    const adapter = call(true);
    await expect(
      validateStatV2ReadOnly({ ...proof, network: "mainnet" }, config, adapter),
    ).rejects.toMatchObject({ category: "RPC_NOT_DEVNET" });
    await expect(
      validateStatV2ReadOnly(
        proof,
        { ...config, programId: "11111111111111111111111111111111" },
        adapter,
      ),
    ).rejects.toMatchObject({ category: "IDL_PROGRAM_MISMATCH" });
    expect(adapter.validate).not.toHaveBeenCalled();
  });
  it("does not turn RPC failure into REJECTED", async () => {
    const adapter = call(true);
    adapter.genesisHash.mockRejectedValueOnce(new Error("secret rpc details"));
    const error = await validateStatV2ReadOnly(proof, config, adapter).catch(
      (value: unknown) => value,
    );
    expect(error).toBeInstanceOf(SolanaValidationError);
    expect(error).toMatchObject({ category: "RPC_UNAVAILABLE" });
    expect(String(error)).not.toContain("secret rpc details");
  });
});
