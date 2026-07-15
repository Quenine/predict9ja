import { db, importScoreHistory } from "@predict9ja/db";
import {
  configFromEnvironment,
  createHttpTxlineClient,
  TxlineHistoricalUnavailableError,
  TxlineMalformedResponseError,
} from "@predict9ja/txline";
import { requiredOption } from "./arguments";
import {
  classifyHistoricalAvailability,
  historicalAvailabilityReason,
} from "./history-availability";

const HISTORY_UNAVAILABLE_EXIT_CODE = 2;
const MALFORMED_PROVIDER_RESPONSE_EXIT_CODE = 3;
const fixtureId = requiredOption("fixture-id");
const fixture = await db.fixture.findUnique({
  where: { sourceId: fixtureId },
  select: { startsAt: true },
});
const availability = classifyHistoricalAvailability(fixture?.startsAt);

if (availability === "TOO_RECENT" || availability === "TOO_OLD") {
  console.log(
    JSON.stringify({
      fixtureId,
      imported: false,
      availability,
      reason: historicalAvailabilityReason(availability),
    }),
  );
  process.exitCode = HISTORY_UNAVAILABLE_EXIT_CODE;
} else {
  const config = configFromEnvironment(process.env);
  try {
    const batch = await createHttpTxlineClient(config).getHistoricalScores(fixtureId);
    const persisted = await importScoreHistory(batch.scores);
    console.log(
      JSON.stringify({
        network: config.network,
        fixtureId,
        imported: true,
        availability,
        fetched: batch.fetched,
        accepted: batch.scores.length,
        rejected: batch.rejected,
        rejectionReasons: batch.rejectionReasons,
        ...persisted,
      }),
    );
  } catch (error) {
    if (error instanceof TxlineHistoricalUnavailableError) {
      console.log(
        JSON.stringify({
          fixtureId: error.fixtureId,
          imported: false,
          availability,
          reason: error.reason,
          status: error.status,
          endpointCategory: error.endpointCategory,
        }),
      );
      process.exitCode = HISTORY_UNAVAILABLE_EXIT_CODE;
    } else if (error instanceof TxlineMalformedResponseError) {
      console.log(
        JSON.stringify({
          fixtureId,
          imported: false,
          availability,
          reason: error.reason,
          status: error.status,
          endpointCategory: error.endpointCategory,
        }),
      );
      process.exitCode = MALFORMED_PROVIDER_RESPONSE_EXIT_CODE;
    } else {
      throw error;
    }
  }
}
