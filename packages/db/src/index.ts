import type { FixtureStatus, SourceMode } from "@predict9ja/domain";
import { PrismaClient } from "@prisma/client";
import type { Prisma } from "@prisma/client";
import { withAccelerate } from "@prisma/extension-accelerate";
import type { FixtureSnapshotResult, NormalizedFixture } from "@predict9ja/txline";
export * from "./scores";
export * from "./accounts";
export * from "./markets";
export * from "./resolution";
export * from "./proofs";
export * from "./proof-classification";

export class PrismaAccelerateConfigurationError extends Error {
  constructor() {
    super("PRISMA_ACCELERATE_URL_INVALID");
    this.name = "PrismaAccelerateConfigurationError";
  }
}

type DatabaseEnvironment = Readonly<Record<string, string | undefined>>;
type DatabaseClientOptions = Pick<Prisma.PrismaClientOptions, "datasourceUrl">;
type DatabaseClientDependencies<T> = {
  createClient(options?: DatabaseClientOptions): T;
  extendAccelerate(client: T): T;
};

export function resolveAccelerateUrl(environment: DatabaseEnvironment) {
  const configured = environment.PRISMA_ACCELERATE_URL;
  if (configured === undefined) return undefined;
  const value = configured.trim();
  try {
    const protocol = new URL(value).protocol;
    if (protocol !== "prisma:" && protocol !== "prisma+postgres:")
      throw new PrismaAccelerateConfigurationError();
  } catch (error) {
    if (error instanceof PrismaAccelerateConfigurationError) throw error;
    throw new PrismaAccelerateConfigurationError();
  }
  return value;
}

export function createDatabaseClient(environment?: DatabaseEnvironment): PrismaClient;
export function createDatabaseClient<T>(
  environment: DatabaseEnvironment,
  dependencies: DatabaseClientDependencies<T>,
): T;
export function createDatabaseClient<T = PrismaClient>(
  environment: DatabaseEnvironment = process.env,
  dependencies?: DatabaseClientDependencies<T>,
) {
  const defaults: DatabaseClientDependencies<PrismaClient> = {
    createClient: (options) => new PrismaClient(options),
    extendAccelerate: (client) => client.$extends(withAccelerate()) as unknown as PrismaClient,
  };
  const selected = dependencies ?? (defaults as DatabaseClientDependencies<T>);
  const accelerateUrl = resolveAccelerateUrl(environment);
  const client = selected.createClient(
    accelerateUrl ? { datasourceUrl: accelerateUrl } : undefined,
  );
  return accelerateUrl ? selected.extendAccelerate(client) : client;
}

const globalDatabase = globalThis as unknown as { prisma?: PrismaClient };
export const db = globalDatabase.prisma ?? createDatabaseClient();
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
    proofFetchCounts,
    proofValidationCounts,
    latestProofAttempt,
    latestSuccessfulValidation,
    localValueMismatches,
    finalisationProofs,
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
    db.scoreProofVerification.groupBy({ by: ["fetchStatus"], _count: true }),
    db.scoreProofVerification.groupBy({ by: ["validationStatus"], _count: true }),
    db.scoreProofVerification.findFirst({ orderBy: { updatedAt: "desc" } }),
    db.scoreProofVerification.findFirst({
      where: { validationStatus: "VERIFIED" },
      orderBy: { verifiedAt: "desc" },
    }),
    db.scoreProofVerification.count({ where: { safeFailureCategory: "LOCAL_VALUE_MISMATCH" } }),
    db.scoreProofVerification.count({
      where: {
        validationStatus: "VERIFIED",
        scoreObservation: { action: "game_finalised", finalised: true },
      },
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
    proofFetchCounts,
    proofValidationCounts,
    latestProofAttempt,
    latestSuccessfulValidation,
    localValueMismatches,
    finalisationProofs,
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
