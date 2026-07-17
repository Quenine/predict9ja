import { describe, expect, it } from "vitest";
import {
  hasDisplayScore,
  observationPresentation,
  providerActionPresentation,
  providerPhasePresentation,
} from "./presentation";

describe("central presentation helpers", () => {
  it("recognizes meaningful scores without inventing a placeholder", () => {
    expect(hasDisplayScore(null, undefined)).toBe(false);
    expect(hasDisplayScore(0, null)).toBe(true);
  });

  it("normalizes provider phase and action without changing raw input", () => {
    expect(providerPhasePresentation("UNKNOWN")).toBe("Phase not supplied");
    expect(providerPhasePresentation("SECOND_HALF")).toBe("Second half");
    expect(providerActionPresentation("unknown")).toBe("Action not classified");
    expect(providerActionPresentation("game_finalised")).toBe("Full time");
  });

  it("presents sequence 962 as an authoritative team-oriented final update", () => {
    expect(
      observationPresentation({
        homeTeam: "England",
        awayTeam: "Argentina",
        participant1IsHome: true,
        participant1Goals: 1,
        participant2Goals: 2,
        phase: "UNKNOWN",
        action: "game_finalised",
        finalised: true,
        authoritative: true,
        sequence: 962,
      }),
    ).toMatchObject({
      title: "Authoritative final observation",
      fanLabel: "Full time",
      score: "England 1–2 Argentina",
      authorityLabel: "Verified final update",
      technicalSummary: "Full time · England 1–2 Argentina",
    });
  });

  it("presents sequence 963 as later and non-authoritative", () => {
    expect(
      observationPresentation({
        homeTeam: "England",
        awayTeam: "Argentina",
        participant1IsHome: true,
        participant1Goals: 1,
        participant2Goals: 2,
        phase: "UNKNOWN",
        action: "unknown",
        finalised: false,
        authoritative: false,
        sequence: 963,
      }),
    ).toMatchObject({
      title: "Later non-authoritative update",
      fanLabel: "Match update",
      authorityLabel: null,
      technicalSummary: "Phase not supplied · action not classified · score values 1–2",
    });
  });
});
