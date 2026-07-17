import { describe, expect, it } from "vitest";
import {
  filterCatalogue,
  fixtureProofState,
  fixtureReplayReady,
  type CatalogueFixture,
} from "./catalogue";

const fixture = (overrides: Partial<CatalogueFixture> = {}): CatalogueFixture => ({
  sourceId: "18241006",
  sourceMode: "LIVE",
  homeTeam: "England",
  awayTeam: "Argentina",
  status: "FINISHED",
  scoreProjection: { finalised: true, latestPhase: "UNKNOWN" },
  proofVerifications: [
    {
      fetchStatus: "FETCHED",
      validationStatus: "VERIFIED",
      observationClassification: "FINAL_MATCH_OBSERVATION",
      providerSequence: 962,
    },
  ],
  scoreObservations: [{ providerSequence: 962 }],
  ...overrides,
});

describe("fixture catalogue", () => {
  it("filters every canonical fixture without an arbitrary fixed limit", () => {
    const values = Array.from({ length: 30 }, (_, index) => fixture({ sourceId: String(index) }));
    expect(filterCatalogue(values, "all", "")).toHaveLength(30);
  });
  it("filters lifecycle, verified proof and replay-ready states", () => {
    const values = [
      fixture(),
      fixture({
        sourceId: "upcoming",
        status: "SCHEDULED",
        scoreProjection: null,
        proofVerifications: [],
        scoreObservations: [],
      }),
    ];
    expect(filterCatalogue(values, "upcoming", "").map((value) => value.sourceId)).toEqual([
      "upcoming",
    ]);
    expect(filterCatalogue(values, "finished", "")).toHaveLength(1);
    expect(filterCatalogue(values, "verified", "")).toHaveLength(1);
    expect(filterCatalogue(values, "replay", "")).toHaveLength(1);
  });
  it("searches both team names case-insensitively", () => {
    expect(filterCatalogue([fixture()], "all", "argENT")).toHaveLength(1);
    expect(filterCatalogue([fixture()], "all", "brazil")).toHaveLength(0);
  });
  it("derives safe proof and replay badges", () => {
    expect(fixtureProofState(fixture())).toBe("Verified");
    expect(fixtureReplayReady(fixture())).toBe(true);
    expect(fixtureProofState(fixture({ proofVerifications: [] }))).toBe("No proof yet");
  });
});
