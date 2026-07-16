import { configFromEnvironment, createHttpTxlineClient } from "@predict9ja/txline";
import { runTxlineCli } from "./txline-cli";
await runTxlineCli(async () => {
  const config = configFromEnvironment(process.env);
  const result = await createHttpTxlineClient(config).snapshots.getFixtures();
  const times = result.fixtures.map((x) => x.startsAt.getTime());
  console.log(
    JSON.stringify({
      network: config.network,
      requestSucceeded: true,
      fixtureCount: result.fetched,
      accepted: result.fixtures.length,
      rejected: result.rejected,
      rejectionReasons: result.rejectionReasons,
      earliestKickoff: times.length ? new Date(Math.min(...times)).toISOString() : null,
      latestKickoff: times.length ? new Date(Math.max(...times)).toISOString() : null,
    }),
  );
});
