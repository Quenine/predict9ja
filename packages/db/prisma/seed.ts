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
        status: "OPEN",
        ruleVersion: template.ruleVersion,
        outcomes: {
          create: template.outcomes.map((outcome) => ({ key: outcome.key, label: outcome.label })),
        },
      },
    });
  }
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
