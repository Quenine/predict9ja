import { db } from "@predict9ja/db";
import { requiredOption } from "./arguments";
const sourceId = requiredOption("fixture-id");
const speed = Number(requiredOption("speed"));
if (!(speed > 0)) throw new Error("--speed must be positive");
const controller = new AbortController();
for (const signal of ["SIGINT", "SIGTERM"] as const) process.once(signal, () => controller.abort());
const fixture = await db.fixture.findUnique({
  where: { sourceId },
  include: { scoreObservations: { orderBy: { providerSequence: "asc" } } },
});
if (!fixture) throw new Error("Fixture not found");
let previous: Date | undefined;
let processed = 0;
await db.replayScoreState.upsert({
  where: { fixtureId: fixture.id },
  create: { fixtureId: fixture.id, status: "RUNNING" },
  update: {
    latestSequence: null,
    phase: "UNKNOWN",
    participant1Goals: null,
    participant2Goals: null,
    finalised: false,
    status: "RUNNING",
  },
});
for (const score of fixture.scoreObservations) {
  if (controller.signal.aborted) break;
  if (previous)
    await new Promise<void>((resolve) => {
      const timer = setTimeout(
        resolve,
        Math.max(0, (score.providerTimestamp.getTime() - previous!.getTime()) / speed),
      );
      controller.signal.addEventListener(
        "abort",
        () => {
          clearTimeout(timer);
          resolve();
        },
        { once: true },
      );
    });
  if (controller.signal.aborted) break;
  await db.replayScoreState.update({
    where: { fixtureId: fixture.id },
    data: {
      latestSequence: score.providerSequence,
      phase: score.phase,
      participant1Goals: score.participant1Goals,
      participant2Goals: score.participant2Goals,
      finalised: score.finalised,
      status: "RUNNING",
    },
  });
  previous = score.providerTimestamp;
  processed++;
}
await db.replayScoreState.update({
  where: { fixtureId: fixture.id },
  data: { status: controller.signal.aborted ? "CANCELLED" : "COMPLETED" },
});
console.log(
  JSON.stringify({
    fixtureId: sourceId,
    speed,
    processed,
    finalState: controller.signal.aborted ? "CANCELLED" : "COMPLETED",
    canonicalObservationsChanged: false,
  }),
);
