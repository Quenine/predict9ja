import { describe, expect, it } from "vitest";
import {
  filterCatalogue,
  fixtureMarketState,
  fixtureProofState,
  formatCatalogueDate,
  ordinaryCatalogue,
  sortCatalogue,
  type CatalogueFixture,
} from "./catalogue";

const fixture = (overrides: Partial<CatalogueFixture> = {}): CatalogueFixture => ({
  sourceId: "18241006",
  sourceMode: "LIVE",
  homeTeam: "England",
  awayTeam: "Argentina",
  status: "FINISHED",
  startsAt: new Date("2026-11-15T09:00:00Z"),
  markets: [],
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

describe("fixture catalogue presentation", () => {
  it("uses contextual proof labels", () => {
    expect(fixtureProofState(fixture())).toBe("Result verified");
    expect(
      fixtureProofState(
        fixture({
          proofVerifications: [
            {
              fetchStatus: "FETCHED",
              validationStatus: "PENDING",
              observationClassification: "UNKNOWN",
              providerSequence: 1,
            },
          ],
        }),
      ),
    ).toBe("Verification data fetched");
    expect(
      fixtureProofState(
        fixture({ status: "SCHEDULED", scoreProjection: null, proofVerifications: [] }),
      ),
    ).toBe("Verification not available yet");
    expect(
      fixtureProofState(fixture({ status: "LIVE", scoreProjection: null, proofVerifications: [] })),
    ).toBe("Verification pending");
    expect(fixtureProofState(fixture({ proofVerifications: [] }))).toBe("Verification unavailable");
  });
  it("uses honest contextual market labels", () => {
    expect(fixtureMarketState(fixture())).toBe("Replay & predict");
    expect(
      fixtureMarketState(
        fixture({
          sourceId: "active",
          markets: [{ status: "OPEN" }],
          proofVerifications: [],
          scoreObservations: [],
        }),
      ),
    ).toBe("Predictions: open");
    expect(
      fixtureMarketState(
        fixture({
          sourceId: "upcoming",
          status: "SCHEDULED",
          scoreProjection: null,
          proofVerifications: [],
          scoreObservations: [],
        }),
      ),
    ).toBe("Tracking starts at kickoff");
    expect(
      fixtureMarketState(
        fixture({
          sourceId: "live",
          status: "LIVE",
          scoreProjection: null,
          proofVerifications: [],
          scoreObservations: [],
        }),
      ),
    ).toBe("Predictions unavailable");
    expect(
      fixtureMarketState(
        fixture({ sourceId: "finished", proofVerifications: [], scoreObservations: [] }),
      ),
    ).toBe("Predictions unavailable");
    expect(fixtureMarketState(fixture({ sourceMode: "SYNTHETIC" }))).toBe("Demo predictions");
  });
  it("excludes the featured replay and retains all other canonical fixtures", () => {
    expect(
      ordinaryCatalogue([fixture(), fixture({ sourceId: "ordinary" })]).map(
        (item) => item.sourceId,
      ),
    ).toEqual(["ordinary"]);
  });
  it("sorts live, nearest upcoming, newest finished, then other states", () => {
    const values = [
      fixture({ sourceId: "unknown", status: "UNKNOWN", scoreProjection: null }),
      fixture({
        sourceId: "old-finished",
        startsAt: new Date("2025-01-01"),
        scoreObservations: [],
      }),
      fixture({
        sourceId: "later",
        status: "SCHEDULED",
        startsAt: new Date("2027-02-01"),
        scoreProjection: null,
      }),
      fixture({ sourceId: "live", status: "LIVE", scoreProjection: null }),
      fixture({
        sourceId: "near",
        status: "SCHEDULED",
        startsAt: new Date("2027-01-01"),
        scoreProjection: null,
      }),
      fixture({
        sourceId: "new-finished",
        startsAt: new Date("2026-01-01"),
        scoreObservations: [],
      }),
    ];
    expect(sortCatalogue(values).map((item) => item.sourceId)).toEqual([
      "live",
      "near",
      "later",
      "new-finished",
      "old-finished",
      "unknown",
    ]);
  });
  it("formats compact Africa/Lagos dates without seconds", () => {
    expect(formatCatalogueDate(new Date("2026-11-15T09:00:45Z"))).toBe("15 Nov 2026 · 10:00 WAT");
  });
  it("filters without a fixed limit and keeps isolated replay fixtures out of catalogue input", () => {
    const canonical = Array.from({ length: 30 }, (_, index) =>
      fixture({ sourceId: String(index) }),
    );
    expect(filterCatalogue(canonical, "all", "")).toHaveLength(30);
    expect(
      ordinaryCatalogue([
        fixture({ sourceId: "judge-replay:18241006:user", sourceMode: "REPLAY" }),
      ]),
    ).toHaveLength(0);
  });
});
