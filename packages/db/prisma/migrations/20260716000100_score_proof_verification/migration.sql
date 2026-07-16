CREATE TYPE "ProofFetchStatus" AS ENUM ('NOT_REQUESTED', 'FETCHING', 'FETCHED', 'UNAVAILABLE', 'MALFORMED', 'FAILED');
CREATE TYPE "OnChainValidationStatus" AS ENUM ('NOT_REQUESTED', 'VERIFYING', 'VERIFIED', 'REJECTED', 'RPC_UNAVAILABLE', 'NETWORK_MISMATCH', 'PROGRAM_MISMATCH', 'FAILED');

CREATE TABLE "ScoreProofVerification" (
    "id" TEXT NOT NULL,
    "fixtureId" TEXT NOT NULL,
    "scoreObservationId" TEXT,
    "fixtureSourceId" TEXT NOT NULL,
    "providerSequence" INTEGER NOT NULL,
    "network" TEXT NOT NULL,
    "statKeys" JSONB NOT NULL,
    "statKeyIdentity" TEXT NOT NULL,
    "statValues" JSONB,
    "targetTimestamp" TIMESTAMP(3),
    "epochDay" INTEGER,
    "dailyScoresPda" TEXT,
    "programId" TEXT,
    "proofPayloadDigest" TEXT,
    "fetchStatus" "ProofFetchStatus" NOT NULL DEFAULT 'NOT_REQUESTED',
    "validationStatus" "OnChainValidationStatus" NOT NULL DEFAULT 'NOT_REQUESTED',
    "validationStrategy" TEXT,
    "safeFailureCategory" TEXT,
    "fetchedAt" TIMESTAMP(3),
    "verifiedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "ScoreProofVerification_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "ResolutionReceipt" ADD COLUMN "proofVerificationId" TEXT;
CREATE UNIQUE INDEX "ResolutionReceipt_proofVerificationId_key" ON "ResolutionReceipt"("proofVerificationId");
CREATE UNIQUE INDEX "ScoreProofVerification_network_fixtureSourceId_providerSequence_statKeyIdentity_key"
ON "ScoreProofVerification"("network", "fixtureSourceId", "providerSequence", "statKeyIdentity");
CREATE INDEX "ScoreProofVerification_fetchStatus_idx" ON "ScoreProofVerification"("fetchStatus");
CREATE INDEX "ScoreProofVerification_validationStatus_idx" ON "ScoreProofVerification"("validationStatus");
CREATE INDEX "ScoreProofVerification_fixtureId_providerSequence_idx" ON "ScoreProofVerification"("fixtureId", "providerSequence");

ALTER TABLE "ScoreProofVerification" ADD CONSTRAINT "ScoreProofVerification_fixtureId_fkey"
FOREIGN KEY ("fixtureId") REFERENCES "Fixture"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ScoreProofVerification" ADD CONSTRAINT "ScoreProofVerification_scoreObservationId_fkey"
FOREIGN KEY ("scoreObservationId") REFERENCES "ScoreObservation"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "ResolutionReceipt" ADD CONSTRAINT "ResolutionReceipt_proofVerificationId_fkey"
FOREIGN KEY ("proofVerificationId") REFERENCES "ScoreProofVerification"("id") ON DELETE SET NULL ON UPDATE CASCADE;
