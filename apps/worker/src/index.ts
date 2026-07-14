import type { SourceMode } from "@predict9ja/domain";
import { z } from "zod";

const environmentSchema = z.object({
  SOURCE_MODE: z.enum(["LIVE", "REPLAY", "SYNTHETIC"]).default("SYNTHETIC"),
  LOG_LEVEL: z.enum(["debug", "info", "warn", "error"]).default("info"),
});

export interface WorkerRunner {
  run(signal: AbortSignal, mode: SourceMode): Promise<void>;
}

const runner: WorkerRunner = {
  run: async (signal) =>
    new Promise<void>((resolve) =>
      signal.addEventListener("abort", () => resolve(), { once: true }),
    ),
};

const config = environmentSchema.parse(process.env);
const controller = new AbortController();
console.log(
  JSON.stringify({ event: "worker.started", mode: config.SOURCE_MODE, level: config.LOG_LEVEL }),
);

for (const signal of ["SIGINT", "SIGTERM"] as const) {
  process.once(signal, () => {
    console.log(JSON.stringify({ event: "worker.stopping", signal }));
    controller.abort();
  });
}

await runner.run(controller.signal, config.SOURCE_MODE);
console.log(JSON.stringify({ event: "worker.stopped" }));
