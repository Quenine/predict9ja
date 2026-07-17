import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const read = (path: string) => readFileSync(resolve(process.cwd(), path), "utf8");

describe("fan-facing presentation normalization", () => {
  it("presents an upcoming match without a score placeholder", () => {
    const detail = read("app/arena/[fixtureId]/page.tsx");
    expect(detail).toContain("{hasScore && (");
    expect(detail).toContain("Awaiting kickoff");
    expect(detail).toContain("Tracking starts at kickoff");
    expect(detail).toContain("Final-score verification is checked after full time.");
  });

  it("keeps raw provider values inside technical match details", () => {
    const detail = read("app/arena/[fixtureId]/page.tsx");
    expect(detail).toContain("Technical source details");
    expect(detail).toContain('projection?.latestPhase ?? "UNKNOWN"');
    expect(detail).toContain("phase={item.phase} · action={item.action}");
    expect(detail).toContain("participant1Goals=");
    expect(detail).toContain("participant2Goals=");
    expect(detail).toContain("item.providerSequence === 962");
    expect(detail).toContain("item.providerSequence === 963");
  });

  it("uses team-oriented, normalized fan labels in replay", () => {
    const replay = read("app/judge/judge-demo.tsx");
    expect(replay).toContain("event.score");
    expect(replay).toContain("providerActionPresentation(demo.fixture.action)");
    expect(replay).toContain("Replay complete");
    expect(replay).not.toContain("through game_finalised");
    expect(replay).not.toContain("P1 {");
    expect(replay).not.toContain("P2 {");
  });

  it("provides safe catalogue error and empty states", () => {
    const catalogue = read("app/arena/page.tsx");
    expect(catalogue).toContain("Matches unavailable");
    expect(catalogue).toContain("No matches found");
    expect(catalogue).toContain("Show all matches");
  });

  it("uses normalized homepage, history, and receipt copy", () => {
    expect(read("app/page.tsx")).toContain("your demo result was settled");
    const history = read("app/portfolio/page.tsx");
    expect(history).toContain("Demo credits added");
    expect(history).toContain("Pick placed");
    expect(history).toContain("Winning return");
    expect(history).toContain("Pick refunded");
    expect(history).toContain("Demo reset");
    const receipt = read("app/proofs/[receiptId]/page.tsx");
    expect(receipt).toContain('receipt.settlementStatus === "SETTLED"');
    expect(receipt).toContain('"Completed"');
    expect(receipt).toContain("Receipt integrity");
    expect(receipt).toContain("What this proves");
  });
});
