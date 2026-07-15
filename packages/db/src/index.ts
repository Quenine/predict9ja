import type { FixtureStatus, SourceMode } from "@predict9ja/domain";
import { PrismaClient } from "@prisma/client";
import type { FixtureSnapshotResult, NormalizedFixture } from "@predict9ja/txline";
export * from "./scores";
export * from "./accounts";
export * from "./markets";
export * from "./resolution";

const globalDatabase = globalThis as unknown as { prisma?: PrismaClient };
export const db = globalDatabase.prisma ?? new PrismaClient();
if (process.env.NODE_ENV !== "production") globalDatabase.prisma = db;
export function findFixtureWithMarkets(sourceId: string) {
  return db.fixture.findUnique({
    where: { sourceId },
    include: { markets: { include: { outcomes: true } } },
  });
}
export function findUserPortfolio(userId: string) {
  return db.position.findMany({ where: { userId }, include: { market: true, outcome: true } });
}
export function listFixturesWithMarkets() {
  return db.fixture.findMany({
    orderBy: { startsAt: "asc" },
    include: { markets: { orderBy: { createdAt: "asc" } }, scoreProjection: true },
  });
}
export async function getAdminSummary() {
  const [
    fixtures,
    checkpoint,
    scoreCheckpoint,
    scoreObservations,
    replayState,
    accountCount,
    activeMarkets,
    openPositions,
    unsettledMarkets,
    accounts,
    latestFinalised,
  ] = await Promise.all([
    db.fixture.groupBy({ by: ["sourceMode"], _count: true }),
    db.feedCheckpoint.findUnique({
      where: { sourceMode_streamKey: { sourceMode: "LIVE", streamKey: "fixture-snapshot" } },
    }),
    db.feedCheckpoint.findUnique({
      where: { sourceMode_streamKey: { sourceMode: "LIVE", streamKey: "scores" } },
    }),
    db.scoreObservation.count(),
    db.replayScoreState.findFirst({ orderBy: { updatedAt: "desc" } }),
    db.demoAccount.count(),
    db.market.count({ where: { status: "ACTIVE" } }),
    db.demoPosition.count({ where: { settledAt: null } }),
    db.market.count({ where: { status: "RESOLVED", settlementStatus: "PENDING" } }),
    db.demoAccount.findMany({ include: { ledgerEntries: { select: { amount: true } } } }),
    db.fixtureScoreProjection.findFirst({
      where: { finalised: true },
      orderBy: { latestProviderTimestamp: "desc" },
      include: { fixture: true },
    }),
  ]);
  return {
    fixtures,
    checkpoint,
    scoreCheckpoint,
    scoreObservations,
    replayState,
    accountCount,
    activeMarkets,
    openPositions,
    unsettledMarkets,
    ledgerReconciled: accounts.every(
      (account) =>
        account.availableCredits ===
        account.ledgerEntries.reduce((sum, entry) => sum + entry.amount, 0),
    ),
    latestFinalised,
  };
}
export type FixtureSyncReport = {
  fetched: number;
  accepted: number;
  rejected: number;
  created: number;
  updated: number;
  unchanged: number;
};
function changed(
  current: {
    homeTeam: string;
    awayTeam: string;
    startsAt: Date;
    status: FixtureStatus;
    sourceMode: SourceMode;
    participant1Name: string;
    participant2Name: string;
    participant1IsHome: boolean;
  },
  next: NormalizedFixture,
) {
  return (
    current.homeTeam !== next.homeTeam ||
    current.awayTeam !== next.awayTeam ||
    current.startsAt.getTime() !== next.startsAt.getTime() ||
    current.status !== next.status ||
    current.sourceMode !== next.sourceMode ||
    current.participant1Name !== next.participant1Name ||
    current.participant2Name !== next.participant2Name ||
    current.participant1IsHome !== next.participant1IsHome
  );
}
export async function synchronizeFixtures(
  snapshot: FixtureSnapshotResult,
  client: PrismaClient = db,
): Promise<FixtureSyncReport> {
  return client.$transaction(async (tx) => {
    let created = 0,
      updated = 0,
      unchanged = 0;
    for (const fixture of snapshot.fixtures) {
      const current = await tx.fixture.findUnique({ where: { sourceId: fixture.sourceId } });
      if (!current) {
        await tx.fixture.create({ data: fixture });
        created++;
      } else if (changed(current, fixture)) {
        await tx.fixture.update({
          where: { sourceId: fixture.sourceId },
          data: {
            homeTeam: fixture.homeTeam,
            awayTeam: fixture.awayTeam,
            startsAt: fixture.startsAt,
            status: fixture.status,
            sourceMode: fixture.sourceMode,
            participant1Name: fixture.participant1Name,
            participant2Name: fixture.participant2Name,
            participant1IsHome: fixture.participant1IsHome,
          },
        });
        updated++;
      } else unchanged++;
    }
    const report = {
      fetched: snapshot.fetched,
      accepted: snapshot.fixtures.length,
      rejected: snapshot.rejected,
      created,
      updated,
      unchanged,
    };
    await tx.feedCheckpoint.upsert({
      where: { sourceMode_streamKey: { sourceMode: "LIVE", streamKey: "fixture-snapshot" } },
      create: {
        sourceMode: "LIVE",
        streamKey: "fixture-snapshot",
        cursor: new Date().toISOString(),
        metadata: report,
      },
      update: { cursor: new Date().toISOString(), metadata: report },
    });
    return report;
  });
}
