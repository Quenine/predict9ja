ALTER TABLE "ScoreProofVerification"
ADD COLUMN "normalizedProof" JSONB,
ADD COLUMN "diagnosticSummary" JSONB,
ADD COLUMN "validationHistory" JSONB,
ADD COLUMN "retryCount" INTEGER NOT NULL DEFAULT 0;
