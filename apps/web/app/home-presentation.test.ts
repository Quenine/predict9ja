import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
const source = readFileSync(new URL("./page.tsx", import.meta.url), "utf8");
describe("fan-first homepage", () => {
  it("uses the fan headline and one partner teaser", () => {
    expect(source).toContain("Predict the match. Replay the action. Verify the result.");
    expect(source.match(/Explore Predict9ja for partners/g)).toHaveLength(1);
    expect(source).not.toContain("Campaign and event licensing");
  });
  it("features match exploration and replay CTAs", () => {
    expect(source).toContain("Replay England vs Argentina");
    expect(source).toContain("Explore matches");
  });
});
