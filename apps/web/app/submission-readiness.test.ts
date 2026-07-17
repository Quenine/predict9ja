import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
const read = (path: string) => readFileSync(resolve(process.cwd(), path), "utf8");
describe("submission-ready public product", () => {
  it("excludes Admin from public navigation and exposes active state metadata", () => {
    const source = read("app/public-nav.tsx");
    expect(source).not.toContain("Admin");
    expect(source).toContain("aria-current");
    expect(source).toContain("aria-expanded");
  });
  it("defines production, social and icon metadata", () => {
    const source = read("app/layout.tsx");
    expect(source).toContain("https://predict9ja-web.vercel.app");
    expect(source).toContain("openGraph");
    expect(source).toContain("twitter");
    expect(source).toContain("/icon.svg");
  });
  it("keeps fixture identity and authority inside a technical disclosure", () => {
    const source = read("app/arena/[fixtureId]/page.tsx");
    expect(source).toContain("Technical source details");
    expect(source).toContain("Sequence {item.providerSequence}");
    expect(source).toContain("authoritative final evidence");
    expect(source).toContain("later non-authoritative observation");
  });
  it("provides a portfolio session empty state", () => {
    const source = read("app/portfolio/page.tsx");
    expect(source).toContain("You have not made a pick yet");
    expect(source).toContain("/judge?mode=replay");
    expect(source).toContain("/judge?mode=synthetic");
  });
  it("hides diagnostic commands in production", () => {
    const source = read("app/admin/page.tsx");
    expect(source).toContain('process.env.NODE_ENV !== "production"');
    expect(source).toContain("System diagnostics");
    expect(source).toContain("index: false");
  });
  it("documents deployment, exact walkthrough and implemented endpoints", () => {
    const source = read("../../README.md");
    expect(source).toContain("https://predict9ja-web.vercel.app");
    expect(source).toContain("Exact 90-second judge walkthrough");
    expect(source).toContain("/api/fixtures/snapshot");
    expect(source).toContain("/api/scores/stat-validation");
    expect(source).not.toContain("Continue to **Synthetic");
  });
  it("does not make misleading market or money claims", () => {
    const publicCopy = [
      read("app/page.tsx"),
      read("app/arena/page.tsx"),
      read("app/judge/page.tsx"),
      read("app/proofs/[receiptId]/page.tsx"),
      read("../../README.md"),
    ].join("\n");
    expect(publicCopy).toContain("TxLINE odds are not currently consumed");
    expect(publicCopy).not.toMatch(/real.money (was )?settled/i);
    expect(publicCopy).not.toContain("sequence 963 is final");
  });
});
