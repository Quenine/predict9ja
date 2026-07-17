import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

describe("scheduled fixture synchronization", () => {
  const workflow = readFileSync(
    resolve(process.cwd(), "../../.github/workflows/txline-fixture-sync.yml"),
    "utf8",
  );

  it("uses pinned safe configuration and repository secrets", () => {
    expect(workflow).toContain("workflow_dispatch:");
    expect(workflow).toContain('cron: "*/30 * * * *"');
    expect(workflow).toContain("node-version: 22");
    expect(workflow).toContain("version: 10.12.1");
    expect(workflow).toContain("secrets.PRISMA_ACCELERATE_URL");
    expect(workflow).toContain("secrets.TXLINE_API_TOKEN");
    expect(workflow).toContain("prisma generate --no-engine");
    expect(workflow).toContain("pnpm txline:sync-fixtures");
  });

  it("contains no destructive or privileged workflow commands", () => {
    expect(workflow).not.toMatch(/db:seed|db:deploy|migrate|settle|verify-proof|wallet/i);
    expect(workflow).not.toContain("echo ${{ secrets.");
  });
});
