import { describe, expect, it } from "vitest";
import { classifyPreflight, safeAnchorDiagnostic } from "./diagnostics";
import { epochDayOf, epochDaySeed, exactEqualityPredicates, GENESIS_HASHES } from "./solana";

const passing = {
  isDevnet: true,
  idlMatches: true,
  walletExists: true,
  walletBalanceLamports: 1,
  programExists: true,
  programExecutable: true,
  rootExists: true,
  rootOwnerMatches: true,
};

describe("validation preflight", () => {
  it("pins the complete devnet genesis hash", () => {
    expect(GENESIS_HASHES.devnet).toBe("EtWTRABZaYq6iMfeYKouRu166VU2xqa1wcaWoxPkrZBG");
  });
  it.each([
    ["walletExists", false, "VALIDATION_WALLET_ACCOUNT_MISSING"],
    ["walletBalanceLamports", 0, "VALIDATION_WALLET_UNFUNDED"],
    ["programExists", false, "PROGRAM_ACCOUNT_MISSING"],
    ["programExecutable", false, "PROGRAM_NOT_EXECUTABLE"],
    ["rootExists", false, "DAILY_ROOT_ACCOUNT_MISSING"],
    ["rootOwnerMatches", false, "DAILY_ROOT_OWNER_MISMATCH"],
  ] as const)("classifies %s", (field, value, expected) => {
    expect(classifyPreflight({ ...passing, [field]: value })).toBe(expected);
  });
  it("derives the bounded epoch day and little-endian seed", () => {
    const timestamp = Date.UTC(2026, 6, 15);
    const day = epochDayOf(timestamp);
    expect(epochDaySeed(day).readUInt16LE()).toBe(day);
  });
});

describe("strategies and safe errors", () => {
  it("covers one and two stats exactly once", () => {
    const proof = (keys: number[]) =>
      ({
        requestedStatKeys: keys,
        stats: keys.map((key) => ({ stat: { key, value: key - 1, period: 0 }, proof: [] })),
      }) as never;
    expect(exactEqualityPredicates(proof([1]))).toHaveLength(1);
    expect(exactEqualityPredicates(proof([1, 2])).map((item) => item.index)).toEqual([0, 1]);
  });
  it("extracts an Anchor name and bounds and redacts logs", () => {
    const secretAddress = "7YWHMfk9JZe0LM7NJKzD3FU3vyMzhxQWTeRZ8QjCkBvP";
    const logs = Array.from({ length: 30 }, (_, index) => "log " + index + " " + secretAddress);
    const result = safeAnchorDiagnostic(
      { error: { errorCode: { code: "InvalidMainTreeProof", number: 6010 } }, logs },
      [],
    );
    expect(result.category).toBe("INVALID_MAIN_TREE_PROOF");
    expect(result.anchorErrorName).toBe("InvalidMainTreeProof");
    expect(result.logs).toHaveLength(20);
    expect(result.logs.join(" ")).not.toContain(secretAddress);
  });
});
