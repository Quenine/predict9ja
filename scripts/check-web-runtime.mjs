import { spawn } from "node:child_process";
import { existsSync } from "node:fs";
import { loadEnvFile } from "node:process";
import { resolve } from "node:path";

if (existsSync(".env")) loadEnvFile(".env");
const testUrl = process.env.DATABASE_TEST_URL;
if (!testUrl || !new URL(testUrl).pathname.toLowerCase().includes("test"))
  throw new Error("DATABASE_TEST_URL must identify an isolated test database");
const port = 3219;
const env = {
  ...process.env,
  DATABASE_URL: testUrl,
  DEMO_SESSION_SECRET: process.env.DEMO_SESSION_SECRET ?? "runtime-smoke-session-secret",
  PORT: String(port),
};
const run = (args) =>
  new Promise((resolve, reject) => {
    const child = spawn("pnpm", args, {
      env,
      stdio: "inherit",
      shell: process.platform === "win32",
    });
    child.on("exit", (code) =>
      code === 0 ? resolve() : reject(new Error(`Command failed: ${args.join(" ")}`)),
    );
  });
await run(["--filter", "@predict9ja/db", "db:seed"]);
await run(["--filter", "@predict9ja/db", "smoke:prepare"]);
await run(["--filter", "@predict9ja/web", "build"]);
const server = spawn(
  process.execPath,
  [resolve("apps/web/node_modules/next/dist/bin/next"), "start", "-p", String(port)],
  {
    cwd: resolve("apps/web"),
    env,
    stdio: "inherit",
  },
);
try {
  const base = `http://127.0.0.1:${port}`;
  let health;
  for (let attempt = 0; attempt < 40; attempt++) {
    try {
      health = await fetch(`${base}/api/health`);
      if (health.ok) break;
    } catch {}
    await new Promise((resolve) => setTimeout(resolve, 500));
  }
  if (!health?.ok) throw new Error("Health endpoint did not become ready");
  const results = {};
  for (const route of [
    "/",
    "/arena",
    "/arena/synthetic-kora-savanna-001",
    "/judge",
    "/portfolio",
    "/admin",
  ]) {
    const response = await fetch(`${base}${route}`);
    const body = await response.text();
    if (response.status !== 200) throw new Error(`${route} returned ${response.status}`);
    if (route === "/arena" && body.includes("Arena unavailable"))
      throw new Error("Arena rendered unavailable state");
    if (
      route === "/judge" &&
      (!body.includes("From live sports data to auditable prediction settlement") ||
        !body.includes("Real TxLINE + Solana evidence") ||
        !body.includes("962"))
    )
      throw new Error("Judge evidence missing");
    results[route] = response.status;
  }
  console.log(JSON.stringify({ ok: true, routes: results }));
} finally {
  server.kill("SIGTERM");
}
