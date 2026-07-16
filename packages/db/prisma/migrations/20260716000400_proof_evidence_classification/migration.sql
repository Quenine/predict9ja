ALTER TABLE "ScoreProofVerification"
ADD COLUMN "observationClassification" TEXT NOT NULL DEFAULT 'LOCAL_OBSERVATION_NOT_FOUND',
ADD COLUMN "settlementEvidenceClassification" TEXT NOT NULL DEFAULT 'NOT_FINAL_SETTLEMENT_EVIDENCE',
ADD COLUMN "classificationWarnings" JSONB;
