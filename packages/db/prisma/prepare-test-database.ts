import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";
import { PrismaClient } from "@prisma/client";
const value = process.env.DATABASE_TEST_URL;
if (!value) throw new Error("DATABASE_TEST_URL is required");
const testUrl = new URL(value);
const database = testUrl.pathname.slice(1);
const development = process.env.DATABASE_URL
  ? new URL(process.env.DATABASE_URL).pathname.slice(1)
  : "predict9ja_dev";
if (!database.toLowerCase().includes("test") || database === development)
  throw new Error("DATABASE_TEST_URL must identify a separate test database");
const adminUrl = new URL(value);
adminUrl.pathname = "/postgres";
const admin = new PrismaClient({ datasources: { db: { url: adminUrl.toString() } } });
const quoted = `"${database.replaceAll('"', '""')}"`;
try {
  await admin.$executeRawUnsafe(
    `SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE datname = '${database.replaceAll("'", "''")}' AND pid <> pg_backend_pid()`,
  );
  await admin.$executeRawUnsafe(`DROP DATABASE IF EXISTS ${quoted}`);
  await admin.$executeRawUnsafe(`CREATE DATABASE ${quoted}`);
} finally {
  await admin.$disconnect();
}
await new Promise<void>((resolve, reject) => {
  const prisma = fileURLToPath(new URL("../node_modules/prisma/build/index.js", import.meta.url));
  const child = spawn(process.execPath, [prisma, "migrate", "deploy"], {
    cwd: fileURLToPath(new URL("..", import.meta.url)),
    env: { ...process.env, DATABASE_URL: value },
    stdio: "inherit",
  });
  child.on("exit", (code) =>
    code === 0 ? resolve() : reject(new Error(`Migration deploy failed (${code ?? 1})`)),
  );
});
console.log(JSON.stringify({ prepared: true, database }));
