import { PrismaClient } from "@prisma/client";
import { createMarketTemplates } from "@predict9ja/domain";

const prisma = new PrismaClient();
const sourceId = "synthetic-kora-savanna-001";

async function seed() {
  await prisma.demoUser.upsert({
    where: { id: "demo-user" },
    update: { credits: 10_000 },
    create: { id: "demo-user", displayName: "Demo Predictor", credits: 10_000 },
  });
  const fixture = await prisma.fixture.upsert({
    where: { sourceId },
    update: {},
    create: {
      sourceId,
      sourceMode: "SYNTHETIC",
      homeTeam: "Kora City",
      awayTeam: "Savanna Rovers",
      participant1Name: "Kora City",
      participant2Name: "Savanna Rovers",
      participant1IsHome: true,
      startsAt: new Date("2026-06-15T18:00:00Z"),
      status: "SCHEDULED",
    },
  });
  for (const template of createMarketTemplates(fixture.homeTeam, fixture.awayTeam)) {
    await prisma.market.upsert({
      where: {
        fixtureId_ruleVersion: { fixtureId: fixture.id, ruleVersion: template.ruleVersion },
      },
      update: {},
      create: {
        fixtureId: fixture.id,
        type: template.type,
        title: template.title,
        status: "ACTIVE",
        closeAt: new Date("2026-06-15T18:00:00Z"),
        displayOrder:
          template.type === "MATCH_RESULT" ? 0 : template.type === "TOTAL_GOALS_2_5" ? 1 : 2,
        ruleVersion: template.ruleVersion,
        outcomes: {
          create: template.outcomes.map((outcome) => ({ key: outcome.key, label: outcome.label })),
        },
      },
    });
  }
  const prices: Record<string, number[]> = {
    "match-result@1": [4500, 2800, 2700],
    "total-goals-2.5@1": [5200, 4800],
    "both-teams-to-score@1": [5400, 4600],
  };
  const markets = await prisma.market.findMany({
    where: { fixtureId: fixture.id },
    include: { outcomes: { orderBy: { id: "asc" } } },
  });
  for (const market of markets)
    for (const [index, outcome] of market.outcomes.entries())
      await prisma.outcomeQuote.upsert({
        where: {
          marketId_outcomeId_version: { marketId: market.id, outcomeId: outcome.id, version: 1 },
        },
        update: {},
        create: {
          marketId: market.id,
          outcomeId: outcome.id,
          version: 1,
          priceBasisPoints: prices[market.ruleVersion]?.[index] ?? 5000,
          source: "SYNTHETIC",
        },
      });
  const cliAccount = await prisma.demoAccount.upsert({
    where: { id: "cli-demo-account" },
    update: {},
    create: {
      id: "cli-demo-account",
      label: "Synthetic CLI demonstration",
      availableCredits: 10000,
    },
  });
  await prisma.creditLedgerEntry.upsert({
    where: { reference: "session-grant:cli-demo-account" },
    update: {},
    create: {
      accountId: cliAccount.id,
      amount: 10000,
      entryType: "SESSION_GRANT",
      reference: "session-grant:cli-demo-account",
    },
  });
  const observations = [
    [1, "2026-06-15T17:55:00Z", "phase_update", "NOT_STARTED", null, null, false],
    [2, "2026-06-15T18:15:00Z", "score_update", "FIRST_HALF", 1, 0, false],
    [3, "2026-06-15T18:50:00Z", "phase_update", "HALFTIME", 1, 0, false],
    [4, "2026-06-15T19:25:00Z", "score_update", "SECOND_HALF", 1, 1, false],
    [5, "2026-06-15T19:50:00Z", "phase_update", "FINISHED", 1, 1, false],
    [6, "2026-06-15T19:51:00Z", "game_finalised", "FINISHED", 1, 1, true],
  ] as const;
  for (const [
    providerSequence,
    timestamp,
    action,
    phase,
    participant1Goals,
    participant2Goals,
    finalised,
  ] of observations) {
    await prisma.scoreObservation.upsert({
      where: { fixtureId_providerSequence: { fixtureId: fixture.id, providerSequence } },
      update: {},
      create: {
        fixtureId: fixture.id,
        providerSequence,
        providerTimestamp: new Date(timestamp),
        action,
        phase,
        participant1Goals,
        participant2Goals,
        finalised,
        sourceMode: "SYNTHETIC",
      },
    });
  }
  await prisma.fixtureScoreProjection.upsert({
    where: { fixtureId: fixture.id },
    create: {
      fixtureId: fixture.id,
      latestSequence: 6,
      latestProviderTimestamp: new Date("2026-06-15T19:51:00Z"),
      latestAction: "game_finalised",
      latestPhase: "FINISHED",
      participant1Goals: 1,
      participant2Goals: 1,
      finalised: true,
      sourceMode: "SYNTHETIC",
    },
    update: {},
  });
}

try {
  await seed();
} finally {
  await prisma.$disconnect();
}
