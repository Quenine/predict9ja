import { describe, expect, it } from "vitest";
import {
  assertMarketTransition,
  canTransitionMarket,
  createMarketTemplates,
  isValidOutcomeKey,
  displayedScore,
  displayedTeams,
  soccerPhaseOf,
} from "./index";

describe("market transitions", () => {
  it("accepts supported transitions", () =>
    expect(canTransitionMarket("OPEN", "CLOSED")).toBe(true));
  it("rejects terminal-state transitions", () => {
    expect(canTransitionMarket("RESOLVED", "OPEN")).toBe(false);
    expect(() => assertMarketTransition("DRAFT", "RESOLVED")).toThrow("Invalid market transition");
  });
});

describe("participant and phase mapping", () => {
  it("maps Participant 1 home-listed", () =>
    expect(
      displayedTeams({ participant1Name: "P1", participant2Name: "P2", participant1IsHome: true }),
    ).toEqual({ homeTeam: "P1", awayTeam: "P2" }));
  it("maps Participant 1 away-listed", () =>
    expect(
      displayedTeams({ participant1Name: "P1", participant2Name: "P2", participant1IsHome: false }),
    ).toEqual({ homeTeam: "P2", awayTeam: "P1" }));
  it("maps displayed score", () =>
    expect(displayedScore(false, 1, 3)).toEqual({ homeScore: 3, awayScore: 1 }));
  it("maps known and unknown phases", () => {
    expect(soccerPhaseOf(5)).toBe("FINISHED");
    expect(soccerPhaseOf(999)).toBe("UNKNOWN");
  });
});

describe("market templates", () => {
  it("builds the three first templates", () => {
    const templates = createMarketTemplates("Kora City", "Savanna Rovers");
    expect(templates).toHaveLength(3);
    expect(templates[0]?.outcomes.map(({ key }) => key)).toEqual(["HOME", "DRAW", "AWAY"]);
  });
  it("requires team names", () => expect(() => createMarketTemplates("", "Rovers")).toThrow());
});

describe("outcome keys", () => {
  it("validates keys by market type", () => {
    expect(isValidOutcomeKey("MATCH_RESULT", "DRAW")).toBe(true);
    expect(isValidOutcomeKey("BOTH_TEAMS_TO_SCORE", "DRAW")).toBe(false);
  });
});
