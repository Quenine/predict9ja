import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const source = readFileSync(new URL("./page.tsx", import.meta.url), "utf8");

describe("homepage submission presentation", () => {
  it("features the verified replay CTA", () => {
    expect(source).toContain("Run the verified replay");
    expect(source).toContain("/judge?mode=replay");
  });
  it("does not claim application quotes are TxLINE odds", () => {
    expect(source).toContain("are not TxLINE odds");
    expect(source).not.toContain("TxLINE odds.</p>");
  });
});
