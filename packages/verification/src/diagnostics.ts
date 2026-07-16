import * as anchor from "@coral-xyz/anchor";
import BN from "bn.js";
import {
  ComputeBudgetProgram,
  Connection,
  Keypair,
  LAMPORTS_PER_SOL,
  PublicKey,
} from "@solana/web3.js";
import type { NormalizedScoreStatProof } from "./proof";
import type { SolanaValidationConfig } from "./config";
import type { Txoracle } from "./vendor/txoracle.devnet";
import txoracleIdl from "./vendor/txoracle.devnet.json";
import {
  anchorPayload,
  anchorStrategy,
  COMPUTE_UNIT_LIMIT,
  deriveSolanaValidationContext,
  exactEqualityPredicates,
  GENESIS_HASHES,
  IDL_PROGRAM_ID,
  type SafeAnchorDiagnostic,
  type SolanaFailureCategory,
} from "./solana";

export type ProviderMode = "EPHEMERAL" | "LOCAL_DIAGNOSTIC_WALLET";
export type StageStatus = "NOT_RUN" | "VERIFIED" | "REJECTED" | SolanaFailureCategory;
export type PreflightResult = Readonly<{
  status: "PASSED" | SolanaFailureCategory;
  rpcUrl: string;
  genesisHash: string | null;
  currentSlot: number | null;
  commitment: string;
  providerMode: ProviderMode;
  walletPublicKey: string;
  walletAccountExists: boolean;
  walletBalanceSol: number;
  programId: string;
  programAccountExists: boolean;
  programExecutable: boolean;
  dailyScoresPda: string;
  dailyRootAccountExists: boolean;
  dailyRootOwner: string | null;
  proofTimestamp: number;
  epochDay: number;
  pdaBump: number;
  idlProgramId: string;
}>;
export type DiagnosticStage = Readonly<{
  status: StageStatus;
  anchorErrorCode?: number | undefined;
  anchorErrorName?: string | undefined;
  logs: readonly string[];
}>;
export type StagedDiagnostic = Readonly<{
  preflight: PreflightResult;
  legacyOneStat: DiagnosticStage;
  v2OneStat: DiagnosticStage;
  v2TwoStat: DiagnosticStage;
}>;

const notRun = (): DiagnosticStage => ({ status: "NOT_RUN", logs: [] });
const safeError = (error: unknown, allowed: readonly string[]): DiagnosticStage => {
  const record =
    typeof error === "object" && error !== null ? (error as Record<string, unknown>) : {};
  const nested =
    typeof record.error === "object" && record.error !== null
      ? (record.error as Record<string, unknown>)
      : {};
  const errorCode =
    typeof nested.errorCode === "object" && nested.errorCode !== null
      ? (nested.errorCode as Record<string, unknown>)
      : {};
  const name = typeof errorCode.code === "string" ? errorCode.code : undefined;
  const number = typeof errorCode.number === "number" ? errorCode.number : undefined;
  const source = Array.isArray(record.logs)
    ? record.logs.filter((line): line is string => typeof line === "string")
    : [];
  const logs = source
    .slice(-20)
    .map((line) =>
      line
        .slice(0, 300)
        .replace(/[1-9A-HJ-NP-Za-km-z]{32,44}/g, (value) =>
          allowed.includes(value) ? value : "[REDACTED_ADDRESS]",
        ),
    );
  const text = [
    name,
    typeof record.message === "string" ? record.message.slice(0, 500) : "",
    ...logs,
  ].join(" ");
  let status: SolanaFailureCategory = "UNKNOWN_PROGRAM_FAILURE";
  if (/InvalidMainTreeProof/i.test(text)) status = "INVALID_MAIN_TREE_PROOF";
  else if (/IncompleteStatCoverage/i.test(text)) status = "INCOMPLETE_STAT_COVERAGE";
  else if (/InvalidSubTreeProof|TimeSlotMismatch|TimestampSeedMismatch|Invalid.*Proof/i.test(text))
    status = "ROOT_PROOF_MISMATCH";
  else if (/Constraint/i.test(text)) status = "CONSTRAINT_FAILURE";
  else if (/Instruction.*deserialize|fallback.*not found|decode/i.test(text))
    status = "INSTRUCTION_DECODING_FAILURE";
  else if (/AccountNotInitialized|AccountNotFound|InvalidAccountData/i.test(text))
    status = "ACCOUNT_LOADING_FAILURE";
  else if (/comput(e|ational).*exceed|ComputeBudget/i.test(text)) status = "COMPUTE_EXHAUSTION";
  else if (/simulation|View expected return log/i.test(text)) status = "RPC_SIMULATION_FAILURE";
  return { status, anchorErrorCode: number, anchorErrorName: name, logs };
};

export function safeAnchorDiagnostic(
  error: unknown,
  allowed: readonly string[],
): SafeAnchorDiagnostic {
  const result = safeError(error, allowed);
  return {
    category:
      result.status === "NOT_RUN" || result.status === "VERIFIED" || result.status === "REJECTED"
        ? "UNKNOWN_PROGRAM_FAILURE"
        : result.status,
    anchorErrorCode: result.anchorErrorCode,
    anchorErrorName: result.anchorErrorName,
    logs: result.logs,
  };
}

export type PreflightFacts = Readonly<{
  isDevnet: boolean;
  idlMatches: boolean;
  walletExists: boolean;
  walletBalanceLamports: number;
  programExists: boolean;
  programExecutable: boolean;
  rootExists: boolean;
  rootOwnerMatches: boolean;
}>;
export function classifyPreflight(facts: PreflightFacts): "PASSED" | SolanaFailureCategory {
  if (!facts.isDevnet) return "RPC_NOT_DEVNET";
  if (!facts.idlMatches) return "IDL_PROGRAM_MISMATCH";
  if (!facts.walletExists) return "VALIDATION_WALLET_ACCOUNT_MISSING";
  if (facts.walletBalanceLamports === 0) return "VALIDATION_WALLET_UNFUNDED";
  if (!facts.programExists) return "PROGRAM_ACCOUNT_MISSING";
  if (!facts.programExecutable) return "PROGRAM_NOT_EXECUTABLE";
  if (!facts.rootExists) return "DAILY_ROOT_ACCOUNT_MISSING";
  if (!facts.rootOwnerMatches) return "DAILY_ROOT_OWNER_MISMATCH";
  return "PASSED";
}

export async function preflightProof(
  proof: NormalizedScoreStatProof,
  config: SolanaValidationConfig,
  wallet: Keypair,
  providerMode: ProviderMode,
): Promise<PreflightResult> {
  const connection = new Connection(config.rpcUrl, config.commitment);
  const context = deriveSolanaValidationContext(proof, config);
  const programKey = new PublicKey(config.programId);
  const rootKey = new PublicKey(context.dailyScoresPda);
  const [, bump] = PublicKey.findProgramAddressSync(
    [
      Buffer.from("daily_scores_roots"),
      Buffer.from([context.epochDay & 255, context.epochDay >> 8]),
    ],
    programKey,
  );
  const base = {
    rpcUrl: config.rpcUrl,
    commitment: config.commitment,
    providerMode,
    walletPublicKey: wallet.publicKey.toBase58(),
    programId: config.programId,
    dailyScoresPda: context.dailyScoresPda,
    proofTimestamp: proof.minTimestamp,
    epochDay: context.epochDay,
    pdaBump: bump,
    idlProgramId: IDL_PROGRAM_ID,
  };
  try {
    const [genesisHash, currentSlot, walletInfo, balance, programInfo, rootInfo] =
      await Promise.all([
        connection.getGenesisHash(),
        connection.getSlot(config.commitment),
        connection.getAccountInfo(wallet.publicKey, config.commitment),
        connection.getBalance(wallet.publicKey, config.commitment),
        connection.getAccountInfo(programKey, config.commitment),
        connection.getAccountInfo(rootKey, config.commitment),
      ]);
    const status = classifyPreflight({
      isDevnet: config.network === "devnet" && genesisHash === GENESIS_HASHES.devnet,
      idlMatches: IDL_PROGRAM_ID === config.programId,
      walletExists: walletInfo !== null,
      walletBalanceLamports: balance,
      programExists: programInfo !== null,
      programExecutable: programInfo?.executable ?? false,
      rootExists: rootInfo !== null,
      rootOwnerMatches: rootInfo?.owner.toBase58() === config.programId,
    });
    return {
      ...base,
      status,
      genesisHash,
      currentSlot,
      walletAccountExists: walletInfo !== null,
      walletBalanceSol: balance / LAMPORTS_PER_SOL,
      programAccountExists: programInfo !== null,
      programExecutable: programInfo?.executable ?? false,
      dailyRootAccountExists: rootInfo !== null,
      dailyRootOwner: rootInfo?.owner.toBase58() ?? null,
    };
  } catch {
    return {
      ...base,
      status: "RPC_UNAVAILABLE",
      genesisHash: null,
      currentSlot: null,
      walletAccountExists: false,
      walletBalanceSol: 0,
      programAccountExists: false,
      programExecutable: false,
      dailyRootAccountExists: false,
      dailyRootOwner: null,
    };
  }
}

export async function diagnoseProofReadOnly(
  oneStatProof: NormalizedScoreStatProof,
  twoStatProof: NormalizedScoreStatProof,
  config: SolanaValidationConfig,
  wallet = Keypair.generate(),
  providerMode: ProviderMode = "EPHEMERAL",
): Promise<StagedDiagnostic> {
  const account = await preflightProof(twoStatProof, config, wallet, providerMode);
  if (account.status !== "PASSED")
    return {
      preflight: account,
      legacyOneStat: notRun(),
      v2OneStat: notRun(),
      v2TwoStat: notRun(),
    };
  const connection = new Connection(config.rpcUrl, config.commitment);
  const provider = new anchor.AnchorProvider(connection, new anchor.Wallet(wallet), {
    commitment: config.commitment,
    preflightCommitment: config.commitment,
  });
  const program = new anchor.Program<Txoracle>(txoracleIdl, provider);
  const root = new PublicKey(account.dailyScoresPda);
  const budget = ComputeBudgetProgram.setComputeUnitLimit({ units: COMPUTE_UNIT_LIMIT });
  const allowed = [account.programId, account.dailyScoresPda];
  const run = async (call: Promise<boolean>): Promise<DiagnosticStage> => {
    try {
      return { status: (await call) ? "VERIFIED" : "REJECTED", logs: [] };
    } catch (error) {
      return safeError(error, allowed);
    }
  };
  const booleanResult = async (value: unknown): Promise<boolean> => {
    const resolved: unknown = await Promise.resolve(value);
    if (typeof resolved !== "boolean") throw new Error("INVALID_VIEW_RESULT");
    return resolved;
  };
  const onePayload = anchorPayload(oneStatProof);
  const first = onePayload.stats[0]!;
  const legacy = await run(
    booleanResult(
      program.methods
        .validateStat(
          new BN(oneStatProof.minTimestamp),
          onePayload.fixtureSummary,
          onePayload.fixtureProof,
          onePayload.mainTreeProof,
          { threshold: first.stat.value, comparison: { equalTo: {} } },
          {
            statToProve: first.stat,
            eventStatRoot: onePayload.eventStatRoot,
            statProof: first.statProof,
          },
          null,
          null,
        )
        .accounts({ dailyScoresMerkleRoots: root })
        .preInstructions([budget])
        .view(),
    ),
  );
  const onePredicates = [
    {
      index: 0,
      statKey: first.stat.key,
      comparison: "EQUAL_TO" as const,
      threshold: first.stat.value,
    },
  ];
  const v2One = await run(
    booleanResult(
      program.methods
        .validateStatV2(onePayload, anchorStrategy(onePredicates))
        .accounts({ dailyScoresMerkleRoots: root })
        .preInstructions([budget])
        .view(),
    ),
  );
  const v2Two = (await executeSharedV2(twoStatProof, config, wallet, providerMode)).validation;
  return { preflight: account, legacyOneStat: legacy, v2OneStat: v2One, v2TwoStat: v2Two };
}

export type SharedV2Result = Readonly<{
  providerMode: ProviderMode;
  preflight: PreflightResult;
  validation: DiagnosticStage;
  programId: string;
  dailyScoresPda: string;
  epochDay: number;
  predicates: ReturnType<typeof exactEqualityPredicates>;
}>;

export async function executeSharedV2(
  proof: NormalizedScoreStatProof,
  config: SolanaValidationConfig,
  wallet: Keypair,
  providerMode: ProviderMode,
): Promise<SharedV2Result> {
  const context = deriveSolanaValidationContext(proof, config);
  const account = await preflightProof(proof, config, wallet, providerMode);
  const predicates = exactEqualityPredicates(proof);
  if (account.status !== "PASSED")
    return {
      providerMode,
      preflight: account,
      validation: { status: account.status, logs: [] },
      programId: context.programId,
      dailyScoresPda: context.dailyScoresPda,
      epochDay: context.epochDay,
      predicates,
    };
  const connection = new Connection(config.rpcUrl, config.commitment);
  const provider = new anchor.AnchorProvider(connection, new anchor.Wallet(wallet), {
    commitment: config.commitment,
    preflightCommitment: config.commitment,
  });
  const program = new anchor.Program<Txoracle>(txoracleIdl, provider);
  const root = new PublicKey(context.dailyScoresPda);
  const payload = anchorPayload(proof);
  const allowed = [context.programId, context.dailyScoresPda];
  let validation: DiagnosticStage;
  try {
    const raw: unknown = await program.methods
      .validateStatV2(payload, anchorStrategy(predicates))
      .accounts({ dailyScoresMerkleRoots: root })
      .preInstructions([ComputeBudgetProgram.setComputeUnitLimit({ units: COMPUTE_UNIT_LIMIT })])
      .view();
    if (typeof raw !== "boolean") throw new Error("INVALID_VIEW_RESULT");
    validation = { status: raw ? "VERIFIED" : "REJECTED", logs: [] };
  } catch (error) {
    validation = safeError(error, allowed);
  }
  return {
    providerMode,
    preflight: account,
    validation,
    programId: context.programId,
    dailyScoresPda: context.dailyScoresPda,
    epochDay: context.epochDay,
    predicates,
  };
}
