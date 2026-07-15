import { existsSync } from "node:fs";
import { spawn } from "node:child_process";
import { loadEnvFile } from "node:process";
import { resolve } from "node:path";
if (existsSync(".env")) loadEnvFile(".env");
const value = process.env.DATABASE_TEST_URL;
if (!value) {
  console.error("DATABASE_TEST_URL is required");
  process.exit(1);
}
const database = new URL(value).pathname.slice(1);
const development = process.env.DATABASE_URL
  ? new URL(process.env.DATABASE_URL).pathname.slice(1)
  : "predict9ja_dev";
if (!database.toLowerCase().includes("test") || database === development)
  throw new Error("Refusing to run integration tests against the development database");
const child = spawn(
  process.execPath,
  [
    resolve("packages/db/node_modules/vitest/vitest.mjs"),
    "run",
    "--config",
    "vitest.integration.config.ts",
  ],
  {
    cwd: resolve("packages/db"),
    env: { ...process.env, DATABASE_URL: value },
    stdio: "inherit",
  },
);
child.on("exit", (code) => {
  process.exitCode = code ?? 1;
});
