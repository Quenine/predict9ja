import type { PrismaClient } from "@prisma/client";
import { db } from "./index";
import { generateMarketsForFixture } from "./markets";
import { reconcileAccount } from "./accounts";
import { resolveFixture, settleFixture } from "./resolution";

const TEMPLATE_SOURCE_ID = "synthetic-kora-savanna-001";
const JUDGE_SOURCE_PREFIX = "judge-demo-";

export function judgeDemoSourceId(accountId: string) {
  return `${JUDGE_SOURCE_PREFIX}${accountId}`;
}

export async function initializeJudgeDemo(accountId: string, client: PrismaClient = db) {
  const sourceId = judgeDemoSourceId(accountId);
  const existing = await client.fixture.findUnique({ where: { sourceId } });
  if (!existing) {
    const [account, template] = await Promise.all([
      client.demoAccount.findUnique({ where: { id: accountId }, select: { id: true } }),
      client.fixture.findUnique({
        where: { sourceId: TEMPLATE_SOURCE_ID },
        include: { scoreObservations: { orderBy: { providerSequence: "asc" } } },
      }),
    ]);
    if (!account || !template || template.sourceMode !== "SYNTHETIC")
      throw new Error("JUDGE_DEMO_UNAVAILABLE");
    await client.fixture.create({
      data: {
        sourceId,
        sourceMode: "SYNTHETIC",
        homeTeam: template.homeTeam,
        awayTeam: template.awayTeam,
        participant1Name: template.participant1Name,
        participant2Name: template.participant2Name,
        participant1IsHome: template.participant1IsHome,
        startsAt: new Date(Date.now() + 60 * 60 * 1000),
        status: "SCHEDULED",
        scoreObservations: {
          create: template.scoreObservations.map((observation) => ({
            providerSequence: observation.providerSequence,
            providerTimestamp: observation.providerTimestamp,
            action: observation.action,
            phase: observation.phase,
            period: observation.period,
            participant1Goals: observation.participant1Goals,
            participant2Goals: observation.participant2Goals,
            finalised: observation.finalised,
            sourceMode: "SYNTHETIC",
          })),
        },
      },
    });
  }
  await generateMarketsForFixture(sourceId, "SYNTHETIC", client);
  return getJudgeDemoState(accountId, client);
}

export async function getJudgeDemoState(accountId: string, client: PrismaClient = db) {
  const sourceId = judgeDemoSourceId(accountId);
  const fixture = await client.fixture.findUnique({
    where: { sourceId },
    include: {
      scoreProjection: true,
      markets: {
        orderBy: { displayOrder: "asc" },
        include: {
          receipt: true,
          outcomes: {
            include: {
              quotes: { where: { active: true }, orderBy: { version: "desc" }, take: 1 },
            },
          },
        },
      },
    },
  });
  if (!fixture || fixture.sourceMode !== "SYNTHETIC") return null;
  const marketIds = fixture.markets.map((market) => market.id);
  const account = await client.demoAccount.findUnique({
    where: { id: accountId },
    include: {
      positions: {
        where: { marketId: { in: marketIds } },
        include: {
          market: { include: { receipt: true } },
          outcome: true,
        },
        orderBy: { createdAt: "desc" },
      },
      purchases: {
        where: { marketId: { in: marketIds } },
        include: { market: true, outcome: true },
        orderBy: { createdAt: "desc" },
      },
      ledgerEntries: {
        where: {
          OR: [{ marketId: { in: marketIds } }, { entryType: "SESSION_GRANT" }],
        },
        orderBy: { createdAt: "asc" },
      },
    },
  });
  if (!account) return null;
  return { account, fixture };
}

export async function runJudgeDemoSimulation(accountId: string, client: PrismaClient = db) {
  const sourceId = judgeDemoSourceId(accountId);
  const fixture = await client.fixture.findUnique({
    where: { sourceId },
    include: { scoreObservations: { orderBy: { providerSequence: "asc" } } },
  });
  if (!fixture || fixture.sourceMode !== "SYNTHETIC" || !sourceId.startsWith(JUDGE_SOURCE_PREFIX))
    throw new Error("JUDGE_DEMO_UNAVAILABLE");
  if (fixture.scoreObservations.length === 0) throw new Error("JUDGE_DEMO_UNAVAILABLE");

  for (const observation of fixture.scoreObservations) {
    await client.replayScoreState.upsert({
      where: { fixtureId: fixture.id },
      create: {
        fixtureId: fixture.id,
        latestSequence: observation.providerSequence,
        phase: observation.phase,
        participant1Goals: observation.participant1Goals,
        participant2Goals: observation.participant2Goals,
        finalised: observation.finalised,
        status: "RUNNING",
      },
      update: {
        latestSequence: observation.providerSequence,
        phase: observation.phase,
        participant1Goals: observation.participant1Goals,
        participant2Goals: observation.participant2Goals,
        finalised: observation.finalised,
        status: "RUNNING",
      },
    });
    await client.fixtureScoreProjection.upsert({
      where: { fixtureId: fixture.id },
      create: {
        fixtureId: fixture.id,
        latestSequence: observation.providerSequence,
        latestProviderTimestamp: observation.providerTimestamp,
        latestAction: observation.action,
        latestPhase: observation.phase,
        participant1Goals: observation.participant1Goals,
        participant2Goals: observation.participant2Goals,
        finalised: observation.finalised,
        sourceMode: "SYNTHETIC",
      },
      update: {
        latestSequence: observation.providerSequence,
        latestProviderTimestamp: observation.providerTimestamp,
        latestAction: observation.action,
        latestPhase: observation.phase,
        participant1Goals: observation.participant1Goals,
        participant2Goals: observation.participant2Goals,
        finalised: observation.finalised,
        sourceMode: "SYNTHETIC",
      },
    });
  }
  await client.replayScoreState.update({
    where: { fixtureId: fixture.id },
    data: { status: "COMPLETED" },
  });
  await resolveFixture(sourceId, true, client);
  await settleFixture(sourceId, client);
  const [state, reconciliation] = await Promise.all([
    getJudgeDemoState(accountId, client),
    reconcileAccount(accountId, client),
  ]);
  return { state, reconciliation };
}
