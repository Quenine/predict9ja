ALTER TABLE "Fixture" ADD COLUMN "participant1Name" TEXT;
ALTER TABLE "Fixture" ADD COLUMN "participant2Name" TEXT;
ALTER TABLE "Fixture" ADD COLUMN "participant1IsHome" BOOLEAN;
UPDATE "Fixture" SET "participant1Name" = "homeTeam", "participant2Name" = "awayTeam", "participant1IsHome" = true;
ALTER TABLE "Fixture" ALTER COLUMN "participant1Name" SET NOT NULL;
ALTER TABLE "Fixture" ALTER COLUMN "participant2Name" SET NOT NULL;
ALTER TABLE "Fixture" ALTER COLUMN "participant1IsHome" SET NOT NULL;
ALTER TABLE "FeedCheckpoint" ADD COLUMN "lastAcknowledgedEventId" TEXT,
ADD COLUMN "lastProcessedSequence" INTEGER, ADD COLUMN "lastProcessedAt" TIMESTAMP(3),
ADD COLUMN "connectionOpenedAt" TIMESTAMP(3), ADD COLUMN "lastMessageAt" TIMESTAMP(3),
ADD COLUMN "connectionStatus" TEXT, ADD COLUMN "safeErrorCategory" TEXT;
CREATE TABLE "ScoreObservation" ("id" TEXT NOT NULL, "fixtureId" TEXT NOT NULL, "providerSequence" INTEGER NOT NULL, "providerTimestamp" TIMESTAMP(3) NOT NULL, "sseEventId" TEXT, "action" TEXT NOT NULL, "phase" TEXT NOT NULL, "period" TEXT, "participant1Goals" INTEGER, "participant2Goals" INTEGER, "finalised" BOOLEAN NOT NULL DEFAULT false, "sourceMode" "SourceMode" NOT NULL, "acceptedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, CONSTRAINT "ScoreObservation_pkey" PRIMARY KEY ("id"));
CREATE TABLE "FixtureScoreProjection" ("fixtureId" TEXT NOT NULL, "latestSequence" INTEGER NOT NULL, "latestProviderTimestamp" TIMESTAMP(3) NOT NULL, "latestAction" TEXT NOT NULL, "latestPhase" TEXT NOT NULL, "participant1Goals" INTEGER, "participant2Goals" INTEGER, "finalised" BOOLEAN NOT NULL DEFAULT false, "sourceMode" "SourceMode" NOT NULL, "updatedAt" TIMESTAMP(3) NOT NULL, CONSTRAINT "FixtureScoreProjection_pkey" PRIMARY KEY ("fixtureId"));
CREATE TABLE "ReplayScoreState" ("fixtureId" TEXT NOT NULL, "latestSequence" INTEGER, "phase" TEXT NOT NULL DEFAULT 'UNKNOWN', "participant1Goals" INTEGER, "participant2Goals" INTEGER, "finalised" BOOLEAN NOT NULL DEFAULT false, "status" TEXT NOT NULL DEFAULT 'IDLE', "updatedAt" TIMESTAMP(3) NOT NULL, CONSTRAINT "ReplayScoreState_pkey" PRIMARY KEY ("fixtureId"));
CREATE UNIQUE INDEX "ScoreObservation_fixtureId_providerSequence_key" ON "ScoreObservation"("fixtureId", "providerSequence");
CREATE INDEX "ScoreObservation_fixtureId_providerTimestamp_idx" ON "ScoreObservation"("fixtureId", "providerTimestamp");
ALTER TABLE "ScoreObservation" ADD CONSTRAINT "ScoreObservation_fixtureId_fkey" FOREIGN KEY ("fixtureId") REFERENCES "Fixture"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "FixtureScoreProjection" ADD CONSTRAINT "FixtureScoreProjection_fixtureId_fkey" FOREIGN KEY ("fixtureId") REFERENCES "Fixture"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ReplayScoreState" ADD CONSTRAINT "ReplayScoreState_fixtureId_fkey" FOREIGN KEY ("fixtureId") REFERENCES "Fixture"("id") ON DELETE CASCADE ON UPDATE CASCADE;
