import { describe, expect, it } from "vitest";
import { normalizeScoreBatch, normalizeScoreRecord } from "./scores";
const score = (extra: Record<string, unknown> = {}) => ({
  FixtureId: 42,
  Seq: 1,
  Ts: "2026-06-15T18:00:00Z",
  StatusId: 2,
  Action: "score_update",
  Stats: { 1: 1, 2: "0" },
  ...extra,
});
describe("score normalization", () => {
  it("supports aliases and normalizes fixture IDs", () =>
    expect(
      normalizeScoreRecord({
        fixtureId: "x",
        seq: 2,
        ts: "2026-06-15T18:00:00Z",
        statusId: 3,
        action: "phase_update",
      }),
    ).toMatchObject({ fixtureSourceId: "x", sequence: 2, phase: "HALFTIME" }));
  it("maps participant stat keys", () =>
    expect(normalizeScoreRecord(score())).toMatchObject({
      participant1Goals: 1,
      participant2Goals: 0,
    }));
  it("allows missing stats on non-score events", () =>
    expect(
      normalizeScoreRecord(score({ Stats: undefined, Action: "phase_update" })).participant1Goals,
    ).toBeNull());
  it("detects only explicit finalisation", () => {
    expect(normalizeScoreRecord(score({ StatusId: 5, Action: "phase_update" })).finalised).toBe(
      false,
    );
    expect(normalizeScoreRecord(score({ Action: "game_finalised" })).finalised).toBe(true);
  });
  it("rejects invalid sequence, timestamps, malformed and negative stats", () => {
    expect(() => normalizeScoreRecord(score({ Seq: 0 }))).toThrow("invalid_sequence");
    expect(() => normalizeScoreRecord(score({ Ts: "bad" }))).toThrow("invalid_timestamp");
    expect(() => normalizeScoreRecord(score({ Stats: [] }))).toThrow("malformed_stats");
    expect(() => normalizeScoreRecord(score({ Stats: { 1: -1 } }))).toThrow("negative_score");
  });
  it("partially rejects and groups safe reasons", () =>
    expect(normalizeScoreBatch([score(), score({ Seq: 0 }), score({ Seq: -1 })])).toMatchObject({
      fetched: 3,
      rejected: 2,
      rejectionReasons: { invalid_sequence: 2 },
    }));
});
