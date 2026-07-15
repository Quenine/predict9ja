import { existsSync } from "node:fs";
import { spawn } from "node:child_process";
import { loadEnvFile } from "node:process";
if (existsSync(".env")) loadEnvFile(".env");
const [command, ...args] = process.argv.slice(2);
if (!command) throw new Error("Command is required");
const child = spawn(
  process.platform === "win32" && command === "pnpm" ? "pnpm.cmd" : command,
  args,
  { env: process.env, stdio: "inherit", shell: process.platform === "win32" },
);
child.on("exit", (code, signal) => {
  if (signal) process.kill(process.pid, signal);
  else process.exitCode = code ?? 1;
});
