import { importScoreHistory } from "@predict9ja/db";
import { configFromEnvironment, createHttpTxlineClient } from "@predict9ja/txline";
import { requiredOption } from "./arguments";
import { runTxlineCli } from "./txline-cli";
await runTxlineCli(async () => {
  const fixtureId = requiredOption("fixture-id");
  const config = configFromEnvironment(process.env);
  const snapshot = await createHttpTxlineClient(config).getScoresSnapshot(fixtureId);
  const persisted = await importScoreHistory(snapshot.scores);
  console.log(
    JSON.stringify({
      network: config.network,
      fixtureId,
      fetched: snapshot.fetched,
      accepted: snapshot.scores.length,
      rejected: snapshot.rejected,
      rejectionReasons: snapshot.rejectionReasons,
      duplicate: persisted.duplicated,
      stale: persisted.stored,
      applied: persisted.applied,
    }),
  );
});
