export function buildValidationSupportBundle(
  input: Readonly<{
    network: string;
    fixtureId: string;
    sequence: number;
    statKeys: unknown;
    statValues: unknown;
    proofTimestamp: string | null;
    epochDay: number | null;
    programId: string | null;
    dailyRootPda: string | null;
    providerMode: string | null;
    proofPayloadDigest: string | null;
    validationStatus: string;
    observationClassification: string;
    settlementEvidenceClassification: string;
    verifiedAt: string | null;
    diagnostic: unknown;
  }>,
) {
  return {
    network: input.network,
    endpointCategory: "PROOF_FETCH",
    httpStatus: null,
    fixtureId: input.fixtureId,
    sequence: input.sequence,
    statKeys: input.statKeys,
    statValues: input.statValues,
    proofTimestamp: input.proofTimestamp,
    proofPayloadDigest: input.proofPayloadDigest,
    validationStatus: input.validationStatus,
    observationClassification: input.observationClassification,
    settlementEvidenceClassification: input.settlementEvidenceClassification,
    verifiedAt: input.verifiedAt,
    epochDay: input.epochDay,
    programId: input.programId,
    dailyRootPda: input.dailyRootPda,
    providerMode: input.providerMode,
    diagnostic: input.diagnostic,
    idlUpstreamCommit: "eba4cb4d578bdb5cfad3c22dfd134f012496e445",
  };
}
