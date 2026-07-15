import {
  db,
  generateMarketsForFixture,
  purchasePosition,
  reconcileAccount,
  resolveFixture,
  settleFixture,
} from "@predict9ja/db";
const sourceId = "synthetic-kora-savanna-001";
await generateMarketsForFixture(sourceId);
const fixture = await db.fixture.findUniqueOrThrow({
  where: { sourceId },
  include: {
    markets: {
      include: { outcomes: { include: { quotes: { where: { active: true }, take: 1 } } } },
    },
    scoreObservations: { orderBy: { providerSequence: "asc" } },
  },
});
const market = fixture.markets.find((value) => value.ruleVersion === "match-result@1");
if (!market) throw new Error("Synthetic match market missing");
for (const [key, stake] of [
  ["DRAW", 100],
  ["HOME", 100],
] as const) {
  const outcome = market.outcomes.find((value) => value.key === key);
  const quote = outcome?.quotes[0];
  if (!quote) throw new Error("Synthetic quote missing");
  await purchasePosition("cli-demo-account", {
    marketId: market.id,
    outcomeKey: key,
    stakeCredits: stake,
    quoteVersion: quote.version,
    idempotencyKey: `demo-${key.toLowerCase()}-v1`,
  });
}
for (const score of fixture.scoreObservations)
  await db.replayScoreState.upsert({
    where: { fixtureId: fixture.id },
    create: {
      fixtureId: fixture.id,
      latestSequence: score.providerSequence,
      phase: score.phase,
      participant1Goals: score.participant1Goals,
      participant2Goals: score.participant2Goals,
      finalised: score.finalised,
      status: "RUNNING",
    },
    update: {
      latestSequence: score.providerSequence,
      phase: score.phase,
      participant1Goals: score.participant1Goals,
      participant2Goals: score.participant2Goals,
      finalised: score.finalised,
      status: "RUNNING",
    },
  });
await db.replayScoreState.update({
  where: { fixtureId: fixture.id },
  data: { status: "COMPLETED" },
});
const final = fixture.scoreObservations.at(-1)!;
await db.fixtureScoreProjection.update({
  where: { fixtureId: fixture.id },
  data: {
    latestSequence: final.providerSequence,
    latestProviderTimestamp: final.providerTimestamp,
    latestAction: final.action,
    latestPhase: final.phase,
    participant1Goals: final.participant1Goals,
    participant2Goals: final.participant2Goals,
    finalised: final.finalised,
  },
});
const resolution = await resolveFixture(sourceId, true);
const settlement = await settleFixture(sourceId);
const reconciliation = await reconcileAccount("cli-demo-account");
console.log(
  JSON.stringify({
    synthetic: true,
    fixtureId: sourceId,
    replayed: fixture.scoreObservations.length,
    resolution,
    settlement,
    reconciliation,
  }),
);
