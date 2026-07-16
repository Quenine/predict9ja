import { describe, expect, it } from "vitest";
import { fixtureDisplayState } from "./fixture-display-state";

describe("fixtureDisplayState", () => {
  it("shows a finalised unknown-phase finished fixture as finished", () => {
    expect(fixtureDisplayState("FINISHED", { finalised: true, latestPhase: "UNKNOWN" })).toBe(
      "finished",
    );
  });

  it("shows a finalised synthetic scheduled fixture as finished", () => {
    expect(fixtureDisplayState("SCHEDULED", { finalised: true, latestPhase: "UNKNOWN" })).toBe(
      "finished",
    );
  });

  it("normalizes a usable live phase", () => {
    expect(fixtureDisplayState("LIVE", { finalised: false, latestPhase: "SECOND_HALF" })).toBe(
      "second half",
    );
  });

  it("uses scheduled when no projection exists", () => {
    expect(fixtureDisplayState("SCHEDULED")).toBe("scheduled");
  });

  it("labels an unknown fixture without a usable projection safely", () => {
    expect(fixtureDisplayState("UNKNOWN", { finalised: false, latestPhase: "UNKNOWN" })).toBe(
      "provider state unknown",
    );
  });

  it("gives cancellation the highest precedence", () => {
    expect(fixtureDisplayState("CANCELLED", { finalised: true, latestPhase: "SECOND_HALF" })).toBe(
      "cancelled",
    );
  });
});
