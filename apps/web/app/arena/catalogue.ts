export const FEATURED_REPLAY_SOURCE_ID = "18241006";

export type CatalogueFilter = "all" | "upcoming" | "live" | "finished" | "verified" | "replay";

export type CatalogueFixture = Readonly<{
  sourceId: string;
  sourceMode: string;
  homeTeam: string;
  awayTeam: string;
  status: string;
  startsAt: Date;
  markets: readonly Readonly<{ status: string }>[];
  scoreProjection: Readonly<{ finalised: boolean; latestPhase: string }> | null;
  proofVerifications: readonly Readonly<{
    fetchStatus: string;
    validationStatus: string;
    observationClassification: string;
    providerSequence: number;
  }>[];
  scoreObservations: readonly Readonly<{ providerSequence: number }>[];
}>;

export function fixtureLifecycle(fixture: CatalogueFixture) {
  if (fixture.status === "CANCELLED") return "cancelled" as const;
  if (fixture.scoreProjection?.finalised || fixture.status === "FINISHED")
    return "finished" as const;
  if (fixture.status === "LIVE") return "live" as const;
  if (fixture.status === "SCHEDULED") return "upcoming" as const;
  return "unknown" as const;
}

export function fixtureProofState(fixture: CatalogueFixture) {
  if (fixture.proofVerifications.some((proof) => proof.validationStatus === "VERIFIED"))
    return "Proof verified" as const;
  if (fixture.proofVerifications.some((proof) => proof.fetchStatus === "FETCHED"))
    return "Proof fetched" as const;
  const lifecycle = fixtureLifecycle(fixture);
  if (lifecycle === "upcoming") return "Proof after final data" as const;
  if (lifecycle === "live") return "Proof pending" as const;
  return "Proof unavailable" as const;
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

export function fixtureMarketState(fixture: CatalogueFixture) {
  if (fixture.sourceMode === "SYNTHETIC") return "Fictional demo markets";
  if (fixtureReplayReady(fixture)) return "Verified replay available";
  if (fixture.markets.length) {
    const states = [...new Set(fixture.markets.map((market) => market.status.toLowerCase()))];
    return `Application markets: ${states.join(", ")}`;
  }
  const lifecycle = fixtureLifecycle(fixture);
  if (lifecycle === "upcoming") return "Fixture data only";
  if (lifecycle === "live") return "Live market unavailable";
  return "No application market";
}

export function fixtureLifecycleLabel(fixture: CatalogueFixture) {
  const lifecycle = fixtureLifecycle(fixture);
  if (lifecycle === "unknown") return "Provider state unknown";
  return lifecycle.charAt(0).toUpperCase() + lifecycle.slice(1);
}

export function formatCatalogueDate(value: Date) {
  const parts = new Intl.DateTimeFormat("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
    timeZone: "Africa/Lagos",
  }).formatToParts(value);
  const get = (type: Intl.DateTimeFormatPartTypes) =>
    parts.find((part) => part.type === type)?.value ?? "";
  return `${get("day")} ${get("month")} ${get("year")} · ${get("hour")}:${get("minute")} WAT`;
}

export function sortCatalogue<T extends CatalogueFixture>(fixtures: readonly T[]) {
  const rank = (fixture: T) => {
    const lifecycle = fixtureLifecycle(fixture);
    if (lifecycle === "live") return 0;
    if (lifecycle === "upcoming") return 1;
    if (lifecycle === "finished") return 2;
    return 3;
  };
  return [...fixtures].sort((left, right) => {
    const group = rank(left) - rank(right);
    if (group) return group;
    const direction = rank(left) === 1 ? 1 : -1;
    return direction * (left.startsAt.getTime() - right.startsAt.getTime());
  });
}

export function ordinaryCatalogue<T extends CatalogueFixture>(fixtures: readonly T[]) {
  return sortCatalogue(
    fixtures.filter(
      (fixture) => fixture.sourceMode === "LIVE" && fixture.sourceId !== FEATURED_REPLAY_SOURCE_ID,
    ),
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
    const lifecycle = fixtureLifecycle(fixture);
    if (filter === "upcoming") return lifecycle === "upcoming";
    if (filter === "live") return lifecycle === "live";
    if (filter === "finished") return lifecycle === "finished";
    if (filter === "verified") return fixtureProofState(fixture) === "Proof verified";
    if (filter === "replay") return fixtureReplayReady(fixture);
    return true;
  });
}
