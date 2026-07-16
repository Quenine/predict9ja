import { getProofVerification } from "@predict9ja/db";
import { requiredOption } from "./arguments";

const value = await getProofVerification(requiredOption("verification-id"));
if (!value) throw new Error("VERIFICATION_NOT_FOUND");
const latestDiagnostic =
  typeof value.diagnosticSummary === "object" && value.diagnosticSummary !== null
    ? value.diagnosticSummary
    : {};
const history = Array.isArray(value.validationHistory) ? value.validationHistory : [];
const authoritative = [...history].reverse().find((entry) => {
  if (typeof entry !== "object" || entry === null || Array.isArray(entry)) return false;
  const summary = (entry as Record<string, unknown>).summary;
  if (typeof summary !== "object" || summary === null || Array.isArray(summary)) return false;
  const record = summary as Record<string, unknown>;
  const v2 =
    typeof record.v2TwoStat === "object" && record.v2TwoStat !== null
      ? (record.v2TwoStat as Record<string, unknown>)
      : null;
  const stages =
    typeof record.stages === "object" && record.stages !== null
      ? (record.stages as Record<string, unknown>)
      : null;
  return v2?.status === "VERIFIED" || stages?.stageD === "VERIFIED";
});
const diagnostic =
  authoritative &&
  typeof authoritative === "object" &&
  !Array.isArray(authoritative) &&
  typeof (authoritative as Record<string, unknown>).summary === "object"
    ? (authoritative as Record<string, unknown>).summary!
    : latestDiagnostic;
const diagnosticRecord = diagnostic as Record<string, unknown>;
const preflight =
  typeof diagnosticRecord.preflight === "object" && diagnosticRecord.preflight !== null
    ? (diagnosticRecord.preflight as Record<string, unknown>)
    : {};
const epochDay =
  value.epochDay ?? (typeof preflight.epochDay === "number" ? preflight.epochDay : null);
const programId =
  value.programId ?? (typeof preflight.programId === "string" ? preflight.programId : null);
const dailyRootPda =
  value.dailyScoresPda ??
  (typeof preflight.dailyScoresPda === "string" ? preflight.dailyScoresPda : null);
console.log(
  JSON.stringify({
    network: value.network,
    endpointCategory: "PROOF_FETCH",
    httpStatus: null,
    fixtureId: value.fixtureSourceId,
    sequence: value.providerSequence,
    statKeys: value.statKeys,
    statValues: value.statValues,
    proofTimestamp: value.targetTimestamp?.toISOString() ?? null,
    epochDay,
    programId,
    dailyRootPda,
    providerMode:
      typeof preflight.providerMode === "string" ? preflight.providerMode : value.providerMode,
    diagnostic,
    idlUpstreamCommit: "eba4cb4d578bdb5cfad3c22dfd134f012496e445",
  }),
);
