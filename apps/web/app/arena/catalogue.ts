export type CatalogueFilter = "all" | "upcoming" | "live" | "finished" | "verified" | "replay";

export type CatalogueFixture = Readonly<{
  sourceId: string;
  sourceMode: string;
  homeTeam: string;
  awayTeam: string;
  status: string;
  scoreProjection: Readonly<{ finalised: boolean; latestPhase: string }> | null;
  proofVerifications: readonly Readonly<{
    fetchStatus: string;
    validationStatus: string;
    observationClassification: string;
    providerSequence: number;
  }>[];
  scoreObservations: readonly Readonly<{ providerSequence: number }>[];
}>;

export function fixtureProofState(fixture: CatalogueFixture) {
  if (fixture.proofVerifications.some((proof) => proof.validationStatus === "VERIFIED"))
    return "Verified" as const;
  if (fixture.proofVerifications.some((proof) => proof.fetchStatus === "FETCHED"))
    return "Proof fetched" as const;
  return "No proof yet" as const;
}

export function fixtureReplayReady(fixture: CatalogueFixture) {
  return (
    fixture.sourceMode === "LIVE" &&
    fixture.scoreObservations.some((observation) => observation.providerSequence === 962) &&
    fixture.proofVerifications.some(
      (proof) =>
        proof.providerSequence === 962 &&
        proof.validationStatus === "VERIFIED" &&
        proof.observationClassification === "FINAL_MATCH_OBSERVATION",
    )
  );
}

export function filterCatalogue<T extends CatalogueFixture>(
  fixtures: readonly T[],
  filter: CatalogueFilter,
  search: string,
) {
  const needle = search.trim().toLowerCase();
  return fixtures.filter((fixture) => {
    if (
      needle &&
      !fixture.homeTeam.toLowerCase().includes(needle) &&
      !fixture.awayTeam.toLowerCase().includes(needle)
    )
      return false;
    if (filter === "upcoming") return fixture.status === "SCHEDULED";
    if (filter === "live") return fixture.status === "LIVE";
    if (filter === "finished")
      return fixture.status === "FINISHED" || Boolean(fixture.scoreProjection?.finalised);
    if (filter === "verified") return fixtureProofState(fixture) === "Verified";
    if (filter === "replay") return fixtureReplayReady(fixture);
    return true;
  });
}
