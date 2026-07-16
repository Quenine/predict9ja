import { z } from "zod";

export type VerificationNetwork = "devnet" | "mainnet";
export const PROGRAM_IDS: Readonly<Record<VerificationNetwork, string>> = {
  devnet: "6pW64gN1s2uqjHkn1unFeEjAwJkPGHoppGvS715wyP2J",
  mainnet: "9ExbZjAapQww1vfcisDmrngPinHTEfpjYRWMunJgcKaA",
};
export const DEFAULT_RPC_URLS: Readonly<Record<VerificationNetwork, string>> = {
  devnet: "https://api.devnet.solana.com",
  mainnet: "https://api.mainnet-beta.solana.com",
};
const environmentSchema = z.object({
  TXLINE_NETWORK: z.enum(["devnet", "mainnet"]).default("devnet"),
  SOLANA_RPC_URL: z.preprocess(
    (value) => (value === "" ? undefined : value),
    z.string().url().optional(),
  ),
  SOLANA_COMMITMENT: z.enum(["confirmed", "finalized", "processed"]).default("confirmed"),
  SOLANA_VALIDATION_TIMEOUT_MS: z.coerce.number().int().positive().max(60_000).default(15_000),
});
export type SolanaValidationConfig = Readonly<{
  network: VerificationNetwork;
  rpcUrl: string;
  commitment: "confirmed" | "finalized" | "processed";
  timeoutMs: number;
  programId: string;
}>;
export function solanaConfigFromEnvironment(
  environment: NodeJS.ProcessEnv,
): SolanaValidationConfig {
  const value = environmentSchema.parse(environment);
  return {
    network: value.TXLINE_NETWORK,
    rpcUrl: value.SOLANA_RPC_URL ?? DEFAULT_RPC_URLS[value.TXLINE_NETWORK],
    commitment: value.SOLANA_COMMITMENT,
    timeoutMs: value.SOLANA_VALIDATION_TIMEOUT_MS,
    programId: PROGRAM_IDS[value.TXLINE_NETWORK],
  };
}
