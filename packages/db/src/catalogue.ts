import type { PrismaClient } from "@prisma/client";
import { db } from "./index";

export async function getFixtureCatalogue(client: PrismaClient = db) {
  const [fixtures, checkpoint] = await Promise.all([
    client.fixture.findMany({
      where: {
        OR: [
          { sourceMode: "LIVE" },
          { sourceMode: "SYNTHETIC", sourceId: "synthetic-kora-savanna-001" },
        ],
      },
      orderBy: [{ startsAt: "desc" }, { sourceId: "asc" }],
      include: {
        scoreProjection: true,
        markets: { select: { status: true } },
        proofVerifications: {
          orderBy: { updatedAt: "desc" },
          select: {
            fetchStatus: true,
            validationStatus: true,
            observationClassification: true,
            providerSequence: true,
          },
        },
        scoreObservations: {
          where: { action: "game_finalised", finalised: true },
          orderBy: { providerSequence: "desc" },
          take: 1,
          select: { providerSequence: true },
        },
      },
    }),
    client.feedCheckpoint.findUnique({
      where: { sourceMode_streamKey: { sourceMode: "LIVE", streamKey: "fixture-snapshot" } },
    }),
  ]);
  return { fixtures, checkpoint };
}
