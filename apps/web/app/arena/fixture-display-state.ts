import type { FixtureStatus } from "@predict9ja/domain";

type ScoreProjectionState = {
  finalised: boolean;
  latestPhase: string | null;
};

export function fixtureDisplayState(
  fixtureStatus: FixtureStatus,
  scoreProjection?: ScoreProjectionState | null,
) {
  if (fixtureStatus === "CANCELLED") return "cancelled";
  if (scoreProjection?.finalised) return "finished";
  if (fixtureStatus === "FINISHED") return "finished";
  if (scoreProjection?.latestPhase && scoreProjection.latestPhase !== "UNKNOWN")
    return scoreProjection.latestPhase.replaceAll("_", " ").toLowerCase();
  if (fixtureStatus !== "UNKNOWN") return fixtureStatus.toLowerCase();
  return "status updating";
}
