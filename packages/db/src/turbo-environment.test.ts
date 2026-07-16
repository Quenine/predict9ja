import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { expect, it } from "vitest";

it("declares required strict-mode runtime environment variables", () => {
  const turbo = JSON.parse(readFileSync(resolve(process.cwd(), "../../turbo.json"), "utf8")) as {
    globalEnv: string[];
    globalPassThroughEnv: string[];
  };
  expect(turbo.globalEnv).toEqual(
    expect.arrayContaining([
      "TXLINE_NETWORK",
      "TXLINE_REQUEST_TIMEOUT_MS",
      "SOLANA_RPC_URL",
      "SOLANA_COMMITMENT",
      "SOLANA_VALIDATION_TIMEOUT_MS",
      "SOURCE_MODE",
      "LOG_LEVEL",
    ]),
  );
  expect(turbo.globalPassThroughEnv).toEqual(
    expect.arrayContaining(["DATABASE_URL", "DEMO_SESSION_SECRET", "TXLINE_API_TOKEN"]),
  );
});
