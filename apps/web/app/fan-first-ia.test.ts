import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
const read = (path: string) => readFileSync(resolve(process.cwd(), path), "utf8");
describe("fan-first information architecture", () => {
  it("uses only the requested primary navigation labels", () => {
    const nav = read("app/public-nav.tsx");
    expect(nav).toContain("Matches");
    expect(nav).toContain("Replay & Predict");
    expect(nav).toContain("My Picks");
    expect(nav).not.toContain("For Partners");
    expect(nav).not.toContain("Admin");
  });
  it("places For Partners in the footer", () => {
    expect(read("app/layout.tsx")).toContain('<Link href="/partners">For Partners</Link>');
  });
  it("provides supported partner content and the scope boundary", () => {
    const page = read("app/partners/page.tsx");
    expect(page).toContain("Turn live sports data into fan experiences people can trust.");
    expect(page).toContain("Campaign and event licensing");
    expect(page).toContain("does not accept deposits");
    expect(page).toMatch(/custody\s+funds/);
    expect(page).toContain("real-money wagering");
  });
  it("uses fan-facing match, replay, picks and receipt labels", () => {
    expect(read("app/arena/page.tsx")).toContain("Follow the matches. Replay the verified result.");
    expect(read("app/judge/page.tsx")).toContain(
      "Make your pick, then replay a real TxLINE match.",
    );
    expect(read("app/portfolio/page.tsx")).toContain("My Picks");
    expect(read("app/proofs/[receiptId]/page.tsx")).toContain("Prediction receipt");
  });
  it("retains exact technical replay identifiers", () => {
    const detail = read("app/arena/[fixtureId]/page.tsx");
    const judge = read("app/judge/page.tsx");
    expect(detail).toContain("Technical source details");
    expect(detail).toContain("authoritative final evidence");
    expect(detail).toContain("later non-authoritative observation");
    expect(judge).toContain("Proof digest");
    expect(judge).toContain("Daily scores PDA");
  });
  it("renders replay visualization from stored timeline values", () => {
    const replay = read("app/judge/judge-demo.tsx");
    expect(replay).toContain("Historical replay visualization");
    expect(replay).toContain("demo.timeline.map");
    expect(replay).toContain("event.sequence");
    expect(replay).toContain("not a live SSE connection");
    expect(replay).not.toContain("sequence 963");
  });
  it("reveals the complete replay state for reduced-motion users", () => {
    const css = read("app/globals.css");
    expect(css).toContain("prefers-reduced-motion: reduce");
    expect(css).toContain(".historical-visualization li");
  });
  it("keeps provider and value claims honest", () => {
    const docs = read("../../README.md");
    expect(docs).toContain("TxLINE odds are not currently consumed");
    expect(docs).toContain("not a live SSE connection");
    expect(docs).toContain("not continuously hosted");
    expect(docs).toContain("no wallet, custody or real-value transaction");
  });
});
