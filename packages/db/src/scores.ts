import { Prisma, type PrismaClient, type SourceMode } from "@prisma/client";
import type { NormalizedScore } from "@predict9ja/txline";
import { db } from "./index";

export class ScoreIntegrityError extends Error {
  constructor() {
    super("Conflicting score observation for fixture and sequence");
    this.name = "ScoreIntegrityError";
  }
}
export type ScoreApplyResult = "applied" | "duplicate" | "stored";
const same = (
  current: {
    providerTimestamp: Date;
    action: string;
    phase: string;
    period: string | null;
    participant1Goals: number | null;
    participant2Goals: number | null;
    finalised: boolean;
    sourceMode: SourceMode;
  },
  score: NormalizedScore,
) =>
  current.providerTimestamp.getTime() === score.providerTimestamp.getTime() &&
  current.action === score.action &&
  current.phase === score.phase &&
  current.period === score.period &&
  current.participant1Goals === score.participant1Goals &&
  current.participant2Goals === score.participant2Goals &&
  current.finalised === score.finalised &&
  current.sourceMode === score.sourceMode;

export async function persistScore(
  score: NormalizedScore,
  eventId?: string,
  client: PrismaClient = db,
): Promise<ScoreApplyResult> {
  return client.$transaction(
    async (tx) => {
      const fixture = await tx.fixture.findUnique({ where: { sourceId: score.fixtureSourceId } });
      if (!fixture) throw new Error("Score references an unknown fixture");
      const existing = await tx.scoreObservation.findUnique({
        where: {
          fixtureId_providerSequence: { fixtureId: fixture.id, providerSequence: score.sequence },
        },
      });
      if (existing) {
        if (!same(existing, score)) throw new ScoreIntegrityError();
        return "duplicate";
      }
      await tx.scoreObservation.create({
        data: {
          fixtureId: fixture.id,
          providerSequence: score.sequence,
          providerTimestamp: score.providerTimestamp,
          sseEventId: eventId ?? score.sseEventId ?? null,
          action: score.action,
          phase: score.phase,
          period: score.period,
          participant1Goals: score.participant1Goals,
          participant2Goals: score.participant2Goals,
          finalised: score.finalised,
          sourceMode: score.sourceMode,
        },
      });
      const projection = await tx.fixtureScoreProjection.findUnique({
        where: { fixtureId: fixture.id },
      });
      if (!projection || score.sequence > projection.latestSequence) {
        await tx.fixtureScoreProjection.upsert({
          where: { fixtureId: fixture.id },
          create: {
            fixtureId: fixture.id,
            latestSequence: score.sequence,
            latestProviderTimestamp: score.providerTimestamp,
            latestAction: score.action,
            latestPhase: score.phase,
            participant1Goals: score.participant1Goals,
            participant2Goals: score.participant2Goals,
            finalised: score.finalised,
            sourceMode: score.sourceMode,
          },
          update: {
            latestSequence: score.sequence,
            latestProviderTimestamp: score.providerTimestamp,
            latestAction: score.action,
            latestPhase: score.phase,
            participant1Goals: score.participant1Goals,
            participant2Goals: score.participant2Goals,
            finalised: score.finalised,
            sourceMode: score.sourceMode,
          },
        });
        return "applied";
      }
      return "stored";
    },
    { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
  );
}
export async function importScoreHistory(
  scores: readonly NormalizedScore[],
  client: PrismaClient = db,
) {
  const result = { applied: 0, duplicated: 0, stored: 0 };
  for (const score of [...scores].sort((a, b) => a.sequence - b.sequence)) {
    const status = await persistScore(score, undefined, client);
    if (status === "applied") result.applied++;
    else if (status === "duplicate") result.duplicated++;
    else result.stored++;
  }
  return result;
}
export async function acknowledgeScore(
  fixtureId: string,
  sequence: number,
  providerTimestamp: Date,
  eventId: string | undefined,
  client: PrismaClient = db,
) {
  await client.feedCheckpoint.upsert({
    where: { sourceMode_streamKey: { sourceMode: "LIVE", streamKey: "scores" } },
    create: {
      sourceMode: "LIVE",
      streamKey: "scores",
      cursor: eventId ?? String(sequence),
      lastAcknowledgedEventId: eventId ?? null,
      lastProcessedSequence: sequence,
      lastProcessedAt: providerTimestamp,
      lastMessageAt: new Date(),
      connectionStatus: "CONNECTED",
    },
    update: {
      cursor: eventId ?? String(sequence),
      lastAcknowledgedEventId: eventId ?? null,
      lastProcessedSequence: sequence,
      lastProcessedAt: providerTimestamp,
      lastMessageAt: new Date(),
      connectionStatus: "CONNECTED",
      safeErrorCategory: null,
    },
  });
  return fixtureId;
}
export function getFixtureDetails(sourceId: string) {
  return db.fixture.findUnique({
    where: { sourceId },
    include: {
      markets: true,
      scoreProjection: true,
      replayState: true,
      scoreObservations: { orderBy: { providerSequence: "desc" }, take: 20 },
    },
  });
}
