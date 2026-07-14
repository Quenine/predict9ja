import { configFromEnvironment, createHttpTxlineClient } from "@predict9ja/txline";
import { requiredOption } from "./arguments";
const fixtureId = requiredOption("fixture-id");
const config = configFromEnvironment(process.env);
const result = await createHttpTxlineClient(config).getScoresSnapshot(fixtureId);
const ordered = [...result.scores].sort((a, b) => a.sequence - b.sequence);
const latest = ordered.at(-1);
console.log(
  JSON.stringify({
    network: config.network,
    fixtureId,
    fetched: result.fetched,
    accepted: result.scores.length,
    rejected: result.rejected,
    minimumSequence: ordered[0]?.sequence ?? null,
    maximumSequence: latest?.sequence ?? null,
    latestPhase: latest?.phase ?? null,
    latestScore:
      latest && latest.participant1Goals !== null && latest.participant2Goals !== null
        ? { participant1: latest.participant1Goals, participant2: latest.participant2Goals }
        : null,
    explicitFinalisationObserved: result.scores.some((score) => score.finalised) ? "yes" : "no",
  }),
);
