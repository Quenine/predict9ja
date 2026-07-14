-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateEnum
CREATE TYPE "SourceMode" AS ENUM ('LIVE', 'REPLAY', 'SYNTHETIC');

-- CreateEnum
CREATE TYPE "FixtureStatus" AS ENUM ('SCHEDULED', 'LIVE', 'FINISHED', 'CANCELLED', 'UNKNOWN');

-- CreateEnum
CREATE TYPE "MarketStatus" AS ENUM ('DRAFT', 'OPEN', 'SUSPENDED', 'CLOSED', 'RESOLVED', 'VOID');

-- CreateEnum
CREATE TYPE "SettlementStatus" AS ENUM ('PENDING', 'SETTLED', 'VOID');

-- CreateEnum
CREATE TYPE "ProofStatus" AS ENUM ('PENDING', 'VERIFIED', 'FAILED');

-- CreateTable
CREATE TABLE "DemoUser" (
    "id" TEXT NOT NULL,
    "displayName" TEXT NOT NULL,
    "credits" INTEGER NOT NULL DEFAULT 10000,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DemoUser_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Fixture" (
    "id" TEXT NOT NULL,
    "sourceId" TEXT NOT NULL,
    "sourceMode" "SourceMode" NOT NULL,
    "homeTeam" TEXT NOT NULL,
    "awayTeam" TEXT NOT NULL,
    "startsAt" TIMESTAMP(3) NOT NULL,
    "status" "FixtureStatus" NOT NULL,
    "homeScore" INTEGER,
    "awayScore" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Fixture_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Market" (
    "id" TEXT NOT NULL,
    "fixtureId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "status" "MarketStatus" NOT NULL DEFAULT 'DRAFT',
    "ruleVersion" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Market_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MarketOutcome" (
    "id" TEXT NOT NULL,
    "marketId" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "label" TEXT NOT NULL,

    CONSTRAINT "MarketOutcome_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Trade" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "marketId" TEXT NOT NULL,
    "outcomeId" TEXT NOT NULL,
    "credits" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Trade_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Position" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "marketId" TEXT NOT NULL,
    "outcomeId" TEXT NOT NULL,
    "credits" INTEGER NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Position_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ResolutionReceipt" (
    "id" TEXT NOT NULL,
    "marketId" TEXT NOT NULL,
    "winningOutcomeKey" TEXT,
    "settlementStatus" "SettlementStatus" NOT NULL DEFAULT 'PENDING',
    "proofStatus" "ProofStatus" NOT NULL DEFAULT 'PENDING',
    "proofHash" TEXT,
    "homeScore" INTEGER,
    "awayScore" INTEGER,
    "resolvedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ResolutionReceipt_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FeedCheckpoint" (
    "id" TEXT NOT NULL,
    "sourceMode" "SourceMode" NOT NULL,
    "streamKey" TEXT NOT NULL,
    "cursor" TEXT NOT NULL,
    "metadata" JSONB,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "FeedCheckpoint_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Fixture_sourceId_key" ON "Fixture"("sourceId");

-- CreateIndex
CREATE INDEX "Fixture_startsAt_status_idx" ON "Fixture"("startsAt", "status");

-- CreateIndex
CREATE INDEX "Market_status_idx" ON "Market"("status");

-- CreateIndex
CREATE UNIQUE INDEX "Market_fixtureId_ruleVersion_key" ON "Market"("fixtureId", "ruleVersion");

-- CreateIndex
CREATE UNIQUE INDEX "MarketOutcome_marketId_key_key" ON "MarketOutcome"("marketId", "key");

-- CreateIndex
CREATE INDEX "Trade_userId_createdAt_idx" ON "Trade"("userId", "createdAt");

-- CreateIndex
CREATE INDEX "Trade_marketId_idx" ON "Trade"("marketId");

-- CreateIndex
CREATE UNIQUE INDEX "Position_userId_marketId_outcomeId_key" ON "Position"("userId", "marketId", "outcomeId");

-- CreateIndex
CREATE UNIQUE INDEX "ResolutionReceipt_marketId_key" ON "ResolutionReceipt"("marketId");

-- CreateIndex
CREATE INDEX "ResolutionReceipt_proofHash_idx" ON "ResolutionReceipt"("proofHash");

-- CreateIndex
CREATE UNIQUE INDEX "FeedCheckpoint_sourceMode_streamKey_key" ON "FeedCheckpoint"("sourceMode", "streamKey");

-- AddForeignKey
ALTER TABLE "Market" ADD CONSTRAINT "Market_fixtureId_fkey" FOREIGN KEY ("fixtureId") REFERENCES "Fixture"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MarketOutcome" ADD CONSTRAINT "MarketOutcome_marketId_fkey" FOREIGN KEY ("marketId") REFERENCES "Market"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Trade" ADD CONSTRAINT "Trade_userId_fkey" FOREIGN KEY ("userId") REFERENCES "DemoUser"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Trade" ADD CONSTRAINT "Trade_marketId_fkey" FOREIGN KEY ("marketId") REFERENCES "Market"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Trade" ADD CONSTRAINT "Trade_outcomeId_fkey" FOREIGN KEY ("outcomeId") REFERENCES "MarketOutcome"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Position" ADD CONSTRAINT "Position_userId_fkey" FOREIGN KEY ("userId") REFERENCES "DemoUser"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Position" ADD CONSTRAINT "Position_marketId_fkey" FOREIGN KEY ("marketId") REFERENCES "Market"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Position" ADD CONSTRAINT "Position_outcomeId_fkey" FOREIGN KEY ("outcomeId") REFERENCES "MarketOutcome"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ResolutionReceipt" ADD CONSTRAINT "ResolutionReceipt_marketId_fkey" FOREIGN KEY ("marketId") REFERENCES "Market"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
