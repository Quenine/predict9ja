import { importScoreHistory } from "@predict9ja/db";
import { configFromEnvironment, createHttpTxlineClient } from "@predict9ja/txline";
import { requiredOption } from "./arguments";
const fixtureId = requiredOption("fixture-id");
const config = configFromEnvironment(process.env);
const batch = await createHttpTxlineClient(config).getHistoricalScores(fixtureId);
const persisted = await importScoreHistory(batch.scores);
console.log(
  JSON.stringify({
    network: config.network,
    fixtureId,
    fetched: batch.fetched,
    accepted: batch.scores.length,
    rejected: batch.rejected,
    ...persisted,
  }),
);
