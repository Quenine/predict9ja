import { acknowledgeScore, db, persistScore } from "@predict9ja/db";
import {
  configFromEnvironment,
  createHttpTxlineClient,
  normalizeScoreRecord,
  scoreRejectionReason,
  TxlineSubscriptionError,
} from "@predict9ja/txline";
import { option } from "./arguments";
const duration = Number(option("duration") ?? 0);
const controller = new AbortController();
if (duration > 0) setTimeout(() => controller.abort(), duration * 1000).unref();
for (const signal of ["SIGINT", "SIGTERM"] as const) process.once(signal, () => controller.abort());
const config = configFromEnvironment(process.env);
const client = createHttpTxlineClient(config);
const report = {
  openedConnections: 0,
  heartbeats: 0,
  messagesAccepted: 0,
  rejected: 0,
  rejectionReasons: {} as Record<string, number>,
  duplicated: 0,
  applied: 0,
};
let delay = 1000;
while (!controller.signal.aborted) {
  try {
    const checkpoint = await db.feedCheckpoint.findUnique({
      where: { sourceMode_streamKey: { sourceMode: "LIVE", streamKey: "scores" } },
    });
    const events = await client.openScoresStream({
      signal: controller.signal,
      ...(checkpoint?.lastAcknowledgedEventId
        ? { lastEventId: checkpoint.lastAcknowledgedEventId }
        : {}),
    });
    report.openedConnections++;
    await db.feedCheckpoint.upsert({
      where: { sourceMode_streamKey: { sourceMode: "LIVE", streamKey: "scores" } },
      create: {
        sourceMode: "LIVE",
        streamKey: "scores",
        cursor: "",
        connectionOpenedAt: new Date(),
        connectionStatus: "CONNECTED",
      },
      update: {
        connectionOpenedAt: new Date(),
        connectionStatus: "CONNECTED",
        safeErrorCategory: null,
      },
    });
    for await (const event of events) {
      if (controller.signal.aborted) break;
      if (!event.data.trim()) {
        report.heartbeats++;
        continue;
      }
      try {
        const score = normalizeScoreRecord(JSON.parse(event.data), "LIVE", event.id);
        const state = await persistScore(score, event.id);
        await acknowledgeScore(
          score.fixtureSourceId,
          score.sequence,
          score.providerTimestamp,
          event.id,
        );
        report.messagesAccepted++;
        if (state === "duplicate") report.duplicated++;
        else if (state === "applied") report.applied++;
      } catch (error) {
        report.rejected++;
        const reason = scoreRejectionReason(error);
        report.rejectionReasons[reason] = (report.rejectionReasons[reason] ?? 0) + 1;
      }
    }
    delay = 1000;
  } catch (error) {
    if (controller.signal.aborted) break;
    if (error instanceof TxlineSubscriptionError) throw error;
    await db.feedCheckpoint.updateMany({
      where: { sourceMode: "LIVE", streamKey: "scores" },
      data: { connectionStatus: "RECONNECTING", safeErrorCategory: "TRANSIENT" },
    });
    await new Promise((resolve) =>
      setTimeout(resolve, Math.min(30_000, delay + Math.random() * 250)),
    );
    delay = Math.min(30_000, delay * 2);
  }
}
await db.feedCheckpoint.updateMany({
  where: { sourceMode: "LIVE", streamKey: "scores" },
  data: { connectionStatus: "STOPPED" },
});
console.log(JSON.stringify(report));
