import { readFile } from "node:fs/promises";
import { Keypair } from "@solana/web3.js";
import type { ProviderMode } from "@predict9ja/verification";

export type ResolvedValidationProvider = Readonly<{
  keypair: Keypair;
  mode: ProviderMode;
}>;

export async function resolveValidationProvider(
  environment: NodeJS.ProcessEnv = process.env,
  read: (path: string, encoding: BufferEncoding) => Promise<string> = readFile,
): Promise<ResolvedValidationProvider> {
  const path = environment.TXLINE_VALIDATION_WALLET_PATH;
  if (!path) return { keypair: Keypair.generate(), mode: "EPHEMERAL" };
  if (environment.TXLINE_VALIDATION_DIAGNOSTIC !== "I_UNDERSTAND_THIS_IS_READ_ONLY")
    throw new Error("DIAGNOSTIC_WALLET_GUARD_REQUIRED");
  const raw: unknown = JSON.parse(await read(path, "utf8"));
  if (
    !Array.isArray(raw) ||
    raw.length !== 64 ||
    raw.some((value) => !Number.isInteger(value) || value < 0 || value > 255)
  )
    throw new Error("INVALID_DIAGNOSTIC_WALLET");
  return {
    keypair: Keypair.fromSecretKey(Uint8Array.from(raw as number[])),
    mode: "LOCAL_DIAGNOSTIC_WALLET",
  };
}
