import { Keypair } from "@solana/web3.js";
import { describe, expect, it, vi } from "vitest";
import { resolveValidationProvider } from "./validation-provider";

describe("validation provider resolution", () => {
  it("does not load a local wallet without the diagnostic guard", async () => {
    const read = vi.fn();
    await expect(
      resolveValidationProvider({ TXLINE_VALIDATION_WALLET_PATH: "secret-wallet.json" }, read),
    ).rejects.toThrow("DIAGNOSTIC_WALLET_GUARD_REQUIRED");
    expect(read).not.toHaveBeenCalled();
  });

  it("honors guarded local-wallet configuration without returning path or bytes", async () => {
    const keypair = Keypair.generate();
    const read = vi.fn().mockResolvedValue(JSON.stringify([...keypair.secretKey]));
    const result = await resolveValidationProvider(
      {
        TXLINE_VALIDATION_WALLET_PATH: "secret-wallet.json",
        TXLINE_VALIDATION_DIAGNOSTIC: "I_UNDERSTAND_THIS_IS_READ_ONLY",
      },
      read,
    );
    expect(result.mode).toBe("LOCAL_DIAGNOSTIC_WALLET");
    expect(result.keypair.publicKey.toBase58()).toBe(keypair.publicKey.toBase58());
    expect(
      JSON.stringify({ mode: result.mode, publicKey: result.keypair.publicKey.toBase58() }),
    ).not.toContain("secret-wallet.json");
    expect(JSON.stringify({ mode: result.mode })).not.toContain(
      JSON.stringify([...keypair.secretKey]),
    );
  });

  it("uses ephemeral mode when no path is configured", async () => {
    const result = await resolveValidationProvider({});
    expect(result.mode).toBe("EPHEMERAL");
  });
});
