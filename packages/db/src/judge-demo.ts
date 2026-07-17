import type { PrismaClient } from "@prisma/client";
import { db } from "./index";
import { generateMarketsForFixture } from "./markets";
import { reconcileAccount } from "./accounts";
import { getReceipt, resolveFixture, settleFixture } from "./resolution";

const TEMPLATE_SOURCE_ID = "synthetic-kora-savanna-001";
const JUDGE_SOURCE_PREFIX = "judge-demo-";
const REPLAY_SOURCE_PREFIX = "judge-replay:";
export const CANONICAL_REPLAY_SOURCE_ID = "18241006";
export const CANONICAL_REPLAY_FINAL_SEQUENCE = 962;
export type JudgeDemoMode = "REPLAY" | "SYNTHETIC";

export function judgeDemoSourceId(accountId: string) {
  return `${JUDGE_SOURCE_PREFIX}${accountId}`;
}

export function judgeReplaySourceId(accountId: string) {
  return `${REPLAY_SOURCE_PREFIX}${CANONICAL_REPLAY_SOURCE_ID}:${accountId}`;
}

export function canonicalReplaySourceId(sourceId: string) {
  if (!sourceId.startsWith(REPLAY_SOURCE_PREFIX)) return null;
  const [canonicalId, accountId, ...extra] = sourceId.slice(REPLAY_SOURCE_PREFIX.length).split(":");
  return canonicalId && accountId && extra.length === 0 ? canonicalId : null;
}

export async function judgeMarketBelongsToAccount(
  accountId: string,
  marketId: string,
  client: PrismaClient = db,
) {
  const market = await client.market.findUnique({
    where: { id: marketId },
    select: { fixture: { select: { sourceId: true } } },
  });
  if (!market) return false;
  const sourceId = market.fixture.sourceId;
  if (sourceId.startsWith(JUDGE_SOURCE_PREFIX) || sourceId.startsWith(REPLAY_SOURCE_PREFIX))
    return sourceId === judgeDemoSourceId(accountId) || sourceId === judgeReplaySourceId(accountId);
  return true;
}

export async function initializeJudgeDemo(accountId: string, client: PrismaClient = db) {
  return initializeJudgeMode(accountId, "SYNTHETIC", client);
}

export async function initializeJudgeMode(
  accountId: string,
  mode: JudgeDemoMode,
  client: PrismaClient = db,
) {
  const replay = mode === "REPLAY";
  const sourceId = replay ? judgeReplaySourceId(accountId) : judgeDemoSourceId(accountId);
  const templateSourceId = replay ? CANONICAL_REPLAY_SOURCE_ID : TEMPLATE_SOURCE_ID;
  const existing = await client.fixture.findUnique({ where: { sourceId } });
  if (!existing) {
    const [account, template] = await Promise.all([
      client.demoAccount.findUnique({ where: { id: accountId }, select: { id: true } }),
      client.fixture.findUnique({
        where: { sourceId: templateSourceId },
        include: {
          scoreObservations: {
            where: replay ? { providerSequence: { lte: CANONICAL_REPLAY_FINAL_SEQUENCE } } : {},
            orderBy: { providerSequence: "asc" },
          },
        },
      }),
    ]);
    if (
      !account ||
      !template ||
      (replay && template.sourceMode !== "LIVE") ||
      (!replay && template.sourceMode !== "SYNTHETIC") ||
      (replay &&
        !template.scoreObservations.some(
          (observation) =>
            observation.providerSequence === CANONICAL_REPLAY_FINAL_SEQUENCE &&
            observation.action === "game_finalised" &&
            observation.finalised,
        ))
    )
      throw new Error("JUDGE_DEMO_UNAVAILABLE");
    await client.fixture.create({
      data: {
        sourceId,
        sourceMode: replay ? "REPLAY" : "SYNTHETIC",
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
            sourceMode: replay ? "REPLAY" : "SYNTHETIC",
          })),
        },
      },
    });
  }
  await generateMarketsForFixture(sourceId, "SYNTHETIC", client);
  return getJudgeDemoState(accountId, mode, client);
}

export async function getJudgeDemoState(
  accountId: string,
  mode: JudgeDemoMode | undefined = undefined,
  client: PrismaClient = db,
) {
  const candidates =
    mode === "REPLAY"
      ? [judgeReplaySourceId(accountId)]
      : mode === "SYNTHETIC"
        ? [judgeDemoSourceId(accountId)]
        : [judgeReplaySourceId(accountId), judgeDemoSourceId(accountId)];
  const selected = await client.fixture.findFirst({
    where: { sourceId: { in: candidates } },
    orderBy: { createdAt: "desc" },
    select: { sourceId: true },
  });
  if (!selected) return null;
  const sourceId = selected.sourceId;
  const fixture = await client.fixture.findUnique({
    where: { sourceId },
    include: {
      scoreProjection: true,
      scoreObservations: { orderBy: { providerSequence: "asc" } },
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
  if (!fixture || !["SYNTHETIC", "REPLAY"].includes(fixture.sourceMode)) return null;
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
  return {
    account,
    fixture,
    mode: fixture.sourceMode === "REPLAY" ? ("REPLAY" as const) : ("SYNTHETIC" as const),
    canonicalSourceId: canonicalReplaySourceId(fixture.sourceId),
  };
}

export async function runJudgeDemoSimulation(
  accountId: string,
  mode: JudgeDemoMode | undefined = undefined,
  client: PrismaClient = db,
) {
  const stateBefore = await getJudgeDemoState(accountId, mode, client);
  if (!stateBefore) throw new Error("JUDGE_DEMO_UNAVAILABLE");
  const sourceId = stateBefore.fixture.sourceId;
  const fixture = await client.fixture.findUnique({
    where: { sourceId },
    include: { scoreObservations: { orderBy: { providerSequence: "asc" } } },
  });
  if (
    !fixture ||
    !["SYNTHETIC", "REPLAY"].includes(fixture.sourceMode) ||
    (!sourceId.startsWith(JUDGE_SOURCE_PREFIX) && !canonicalReplaySourceId(sourceId))
  )
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
        sourceMode: fixture.sourceMode,
      },
      update: {
        latestSequence: observation.providerSequence,
        latestProviderTimestamp: observation.providerTimestamp,
        latestAction: observation.action,
        latestPhase: observation.phase,
        participant1Goals: observation.participant1Goals,
        participant2Goals: observation.participant2Goals,
        finalised: observation.finalised,
        sourceMode: fixture.sourceMode,
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
    getJudgeDemoState(accountId, mode, client),
    reconcileAccount(accountId, client),
  ]);
  return { state, reconciliation };
}

export async function getJudgeReceiptContext(
  receiptId: string,
  accountId: string | null,
  client: PrismaClient = db,
) {
  const receipt = await getReceipt(receiptId, client);
  if (!receipt) return null;
  const sourceId = receipt.market.fixture.sourceId;
  const isolated = sourceId.startsWith(JUDGE_SOURCE_PREFIX) || canonicalReplaySourceId(sourceId);
  if (isolated) {
    if (!accountId) return null;
    const ownsReceipt = await client.demoPosition.count({
      where: { accountId, marketId: receipt.marketId },
    });
    if (ownsReceipt === 0) return null;
  }
  const canonicalSourceId = canonicalReplaySourceId(sourceId);
  const position = accountId
    ? await client.demoPosition.findFirst({
        where: { accountId, marketId: receipt.marketId },
        include: { outcome: true },
      })
    : null;
  const purchase = position
    ? await client.demoPurchase.findFirst({
        where: {
          accountId: position.accountId,
          marketId: position.marketId,
          outcomeId: position.outcomeId,
        },
        orderBy: { createdAt: "desc" },
      })
    : null;
  const ledger = position
    ? await client.creditLedgerEntry.findMany({
        where: { accountId: position.accountId, positionId: position.id },
        orderBy: { createdAt: "asc" },
      })
    : [];
  const replaySourceEvidence = canonicalSourceId
    ? await client.scoreProofVerification.findFirst({
        where: {
          fixtureSourceId: canonicalSourceId,
          providerSequence: CANONICAL_REPLAY_FINAL_SEQUENCE,
          validationStatus: "VERIFIED",
          observationClassification: "FINAL_MATCH_OBSERVATION",
          settlementEvidenceClassification: "FINAL_DATA_VERIFIED_NO_RECEIPT",
        },
        include: { scoreObservation: true },
        orderBy: { verifiedAt: "desc" },
      })
    : null;
  return {
    receipt,
    receiptContext: canonicalSourceId
      ? ("HISTORICAL_REPLAY" as const)
      : receipt.sourceMode === "SYNTHETIC"
        ? ("SYNTHETIC_DEMO" as const)
        : ("STANDARD" as const),
    canonicalSourceId,
    replaySourceEvidence,
    position,
    purchase,
    ledger,
  };
}
