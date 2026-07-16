import * as anchor from "@coral-xyz/anchor";
import BN from "bn.js";
import { ComputeBudgetProgram, Connection, Keypair, PublicKey } from "@solana/web3.js";
import type { NormalizedScoreStatProof } from "./proof";
import type { SolanaValidationConfig, VerificationNetwork } from "./config";
import type { Txoracle } from "./vendor/txoracle.devnet";
import txoracleIdl from "./vendor/txoracle.devnet.json";

type OracleTypes = anchor.IdlTypes<Txoracle>;
type StatValidationInput = OracleTypes["statValidationInput"];
type NDimensionalStrategy = OracleTypes["nDimensionalStrategy"];
export const IDL_PROGRAM_ID = txoracleIdl.address;
export const COMPUTE_UNIT_LIMIT = 1_400_000;
export const GENESIS_HASHES: Readonly<Record<VerificationNetwork, string>> = {
  devnet: "EtWTRABZaYq6iMfeYKouRu166VU2xqa1wcaWoxPkrZBG",
  mainnet: "5eykt4UsFv8P8NJdTREpY1vzqKqZKvdpKuc147dw2N9d",
};

export type SolanaValidationStatus = "VERIFIED" | "REJECTED";
export type SolanaFailureCategory =
  | "RPC_NOT_DEVNET"
  | "VALIDATION_WALLET_ACCOUNT_MISSING"
  | "VALIDATION_WALLET_UNFUNDED"
  | "PROGRAM_ACCOUNT_MISSING"
  | "PROGRAM_NOT_EXECUTABLE"
  | "DAILY_ROOT_ACCOUNT_MISSING"
  | "DAILY_ROOT_OWNER_MISMATCH"
  | "PROGRAM_ID_MISMATCH"
  | "IDL_PROGRAM_MISMATCH"
  | "TIMESTAMP_INVALID"
  | "EPOCH_DAY_MISMATCH"
  | "RPC_UNAVAILABLE"
  | "ACCOUNT_LOADING_FAILURE"
  | "INSTRUCTION_DECODING_FAILURE"
  | "CONSTRAINT_FAILURE"
  | "INVALID_MAIN_TREE_PROOF"
  | "INCOMPLETE_STAT_COVERAGE"
  | "PREDICATE_REJECTION"
  | "COMPUTE_EXHAUSTION"
  | "RPC_SIMULATION_FAILURE"
  | "ROOT_PROOF_MISMATCH"
  | "UNKNOWN_PROGRAM_FAILURE";
export class SolanaValidationError extends Error {
  constructor(
    public readonly category: SolanaFailureCategory,
    public readonly diagnostic?: Readonly<{
      anchorErrorCode?: number;
      anchorErrorName?: string;
      logs: readonly string[];
    }>,
  ) {
    super(`Solana validation failed: ${category}`);
    this.name = "SolanaValidationError";
  }
}
export type SafeAnchorDiagnostic = Readonly<{
  category: SolanaFailureCategory;
  anchorErrorCode?: number | undefined;
  anchorErrorName?: string | undefined;
  logs: readonly string[];
}>;
export type ExactPredicateSummary = Readonly<{
  index: number;
  statKey: number;
  comparison: "EQUAL_TO";
  threshold: number;
}>;
export type SolanaValidationResult = Readonly<{
  status: SolanaValidationStatus;
  programId: string;
  dailyScoresPda: string;
  epochDay: number;
  predicates: readonly ExactPredicateSummary[];
}>;

export function epochDayOf(timestamp: number): number {
  const day = Math.floor(timestamp / 86_400_000);
  if (!Number.isInteger(day) || day < 0 || day > 65_535)
    throw new SolanaValidationError("TIMESTAMP_INVALID");
  return day;
}
export function epochDaySeed(epochDay: number): Buffer {
  if (!Number.isInteger(epochDay) || epochDay < 0 || epochDay > 65_535)
    throw new SolanaValidationError("EPOCH_DAY_MISMATCH");
  const seed = Buffer.alloc(2);
  seed.writeUInt16LE(epochDay);
  return seed;
}
export function exactEqualityPredicates(
  proof: NormalizedScoreStatProof,
): readonly ExactPredicateSummary[] {
  if (
    proof.stats.length !== proof.requestedStatKeys.length ||
    proof.stats.length < 1 ||
    proof.stats.length > 8
  )
    throw new SolanaValidationError("INCOMPLETE_STAT_COVERAGE");
  return proof.stats.map(({ stat }, index) => {
    if (stat.key !== proof.requestedStatKeys[index])
      throw new SolanaValidationError("INCOMPLETE_STAT_COVERAGE");
    return { index, statKey: stat.key, comparison: "EQUAL_TO", threshold: stat.value };
  });
}
export function deriveSolanaValidationContext(
  proof: NormalizedScoreStatProof,
  config: SolanaValidationConfig,
) {
  if (proof.network !== config.network) throw new SolanaValidationError("RPC_NOT_DEVNET");
  if (IDL_PROGRAM_ID !== config.programId) throw new SolanaValidationError("IDL_PROGRAM_MISMATCH");
  const epochDay = epochDayOf(proof.minTimestamp);
  const [dailyScoresPda] = PublicKey.findProgramAddressSync(
    [Buffer.from("daily_scores_roots"), epochDaySeed(epochDay)],
    new PublicKey(config.programId),
  );
  return {
    programId: config.programId,
    dailyScoresPda: dailyScoresPda.toBase58(),
    epochDay,
    predicates: exactEqualityPredicates(proof),
  };
}

export type ReadonlyProgramCall = Readonly<{
  validate(
    payload: StatValidationInput,
    strategy: NDimensionalStrategy,
    dailyScoresPda: PublicKey,
  ): Promise<boolean>;
  diagnose(
    payload: StatValidationInput,
    strategy: NDimensionalStrategy,
    dailyScoresPda: PublicKey,
  ): Promise<readonly string[]>;
  genesisHash(): Promise<string>;
  accountOwner(address: PublicKey): Promise<string | null>;
}>;

export function anchorPayload(proof: NormalizedScoreStatProof): StatValidationInput {
  return {
    ts: new BN(proof.minTimestamp),
    fixtureSummary: {
      fixtureId: new BN(proof.fixtureId),
      updateStats: {
        updateCount: proof.updateCount,
        minTimestamp: new BN(proof.minTimestamp),
        maxTimestamp: new BN(proof.maxTimestamp),
      },
      eventsSubTreeRoot: [...proof.eventStatsSubTreeRoot],
    },
    fixtureProof: proof.subTreeProof.map((node) => ({
      hash: [...node.hash],
      isRightSibling: node.isRightSibling,
    })),
    mainTreeProof: proof.mainTreeProof.map((node) => ({
      hash: [...node.hash],
      isRightSibling: node.isRightSibling,
    })),
    eventStatRoot: [...proof.eventStatRoot],
    stats: proof.stats.map(({ stat, proof: nodes }) => ({
      stat,
      statProof: nodes.map((node) => ({
        hash: [...node.hash],
        isRightSibling: node.isRightSibling,
      })),
    })),
  };
}
export function anchorStrategy(predicates: readonly ExactPredicateSummary[]): NDimensionalStrategy {
  return {
    geometricTargets: [],
    distancePredicate: null,
    discretePredicates: predicates.map((predicate) => ({
      single: {
        index: predicate.index,
        predicate: { threshold: predicate.threshold, comparison: { equalTo: {} } },
      },
    })),
  };
}
function liveCall(config: SolanaValidationConfig): ReadonlyProgramCall {
  const connection = new Connection(config.rpcUrl, config.commitment);
  const wallet = new anchor.Wallet(Keypair.generate());
  const provider = new anchor.AnchorProvider(connection, wallet, {
    commitment: config.commitment,
    preflightCommitment: config.commitment,
  });
  const program = new anchor.Program<Txoracle>(txoracleIdl, provider);
  const method = (
    payload: StatValidationInput,
    strategy: NDimensionalStrategy,
    dailyScoresPda: PublicKey,
  ) =>
    program.methods
      .validateStatV2(payload, strategy)
      .accounts({ dailyScoresMerkleRoots: dailyScoresPda })
      .preInstructions([ComputeBudgetProgram.setComputeUnitLimit({ units: COMPUTE_UNIT_LIMIT })]);
  return {
    genesisHash: () => connection.getGenesisHash(),
    accountOwner: async (address) =>
      (await connection.getAccountInfo(address, config.commitment))?.owner.toBase58() ?? null,
    validate: (payload, strategy, dailyScoresPda) =>
      method(payload, strategy, dailyScoresPda).view(),
    diagnose: async (payload, strategy, dailyScoresPda) =>
      (await method(payload, strategy, dailyScoresPda).simulate()).raw,
  };
}
function safeValidationFailure(error: unknown): SolanaFailureCategory {
  const record =
    typeof error === "object" && error !== null ? (error as Record<string, unknown>) : null;
  const anchorError =
    typeof record?.error === "object" && record.error !== null
      ? (record.error as Record<string, unknown>)
      : null;
  const errorCode =
    typeof anchorError?.errorCode === "object" && anchorError.errorCode !== null
      ? (anchorError.errorCode as Record<string, unknown>)
      : null;
  const code = typeof errorCode?.code === "string" ? errorCode.code : "";
  const message = typeof record?.message === "string" ? record.message : "";
  const logs = Array.isArray(record?.logs)
    ? record.logs.filter((line): line is string => typeof line === "string").join(" ")
    : "";
  const safeText = `${code} ${message} ${logs}`;
  if (
    /AccountNotInitialized|AccountNotFound|could not find account|InvalidAccountData/i.test(
      safeText,
    )
  )
    return "ACCOUNT_LOADING_FAILURE";
  if (
    /Invalid.*Proof|MissingProof|ProofTooLarge|StatKeyMismatch|IncompleteStatCoverage/i.test(
      safeText,
    )
  )
    return /IncompleteStatCoverage/i.test(safeText)
      ? "INCOMPLETE_STAT_COVERAGE"
      : "ROOT_PROOF_MISMATCH";
  if (/View expected return log/i.test(safeText)) return "RPC_SIMULATION_FAILURE";
  if (/DeclaredProgramIdMismatch|ProgramMismatch/i.test(safeText)) return "PROGRAM_ID_MISMATCH";
  if (/fetch failed|429|503|timed out|ECONN/i.test(safeText)) return "RPC_UNAVAILABLE";
  if (/Constraint/i.test(safeText)) return "CONSTRAINT_FAILURE";
  if (/comput(e|ational).*exceed|ComputeBudget/i.test(safeText)) return "COMPUTE_EXHAUSTION";
  return "UNKNOWN_PROGRAM_FAILURE";
}
async function withinTimeout<T>(promise: Promise<T>, milliseconds: number): Promise<T> {
  let timer: NodeJS.Timeout | undefined;
  try {
    return await Promise.race([
      promise,
      new Promise<T>((_, reject) => {
        timer = setTimeout(
          () => reject(new SolanaValidationError("RPC_UNAVAILABLE")),
          milliseconds,
        );
      }),
    ]);
  } finally {
    if (timer) clearTimeout(timer);
  }
}

export async function validateStatV2ReadOnly(
  proof: NormalizedScoreStatProof,
  config: SolanaValidationConfig,
  call?: ReadonlyProgramCall,
): Promise<SolanaValidationResult> {
  const context = deriveSolanaValidationContext(proof, config);
  const dailyScoresPda = new PublicKey(context.dailyScoresPda);
  const predicates = context.predicates;
  const adapter = call ?? liveCall(config);
  let genesisHash: string;
  try {
    genesisHash = await withinTimeout(adapter.genesisHash(), config.timeoutMs);
  } catch (error) {
    if (error instanceof SolanaValidationError) throw error;
    throw new SolanaValidationError("RPC_UNAVAILABLE");
  }
  if (genesisHash !== GENESIS_HASHES[config.network])
    throw new SolanaValidationError("RPC_NOT_DEVNET");
  let owner: string | null;
  try {
    owner = await withinTimeout(adapter.accountOwner(dailyScoresPda), config.timeoutMs);
  } catch {
    throw new SolanaValidationError("RPC_UNAVAILABLE");
  }
  if (!owner) throw new SolanaValidationError("DAILY_ROOT_ACCOUNT_MISSING");
  if (owner !== config.programId) throw new SolanaValidationError("DAILY_ROOT_OWNER_MISMATCH");
  let valid: boolean;
  try {
    valid = await withinTimeout(
      adapter.validate(anchorPayload(proof), anchorStrategy(predicates), dailyScoresPda),
      config.timeoutMs,
    );
  } catch (error) {
    if (error instanceof SolanaValidationError) throw error;
    let category = safeValidationFailure(error);
    if (category === "UNKNOWN_PROGRAM_FAILURE") {
      try {
        const logs = await withinTimeout(
          adapter.diagnose(anchorPayload(proof), anchorStrategy(predicates), dailyScoresPda),
          config.timeoutMs,
        );
        category = safeValidationFailure({ logs });
      } catch (diagnosticError) {
        category = safeValidationFailure(diagnosticError);
      }
    }
    throw new SolanaValidationError(category);
  }
  return {
    status: valid ? "VERIFIED" : "REJECTED",
    programId: config.programId,
    dailyScoresPda: context.dailyScoresPda,
    epochDay: context.epochDay,
    predicates,
  };
}
