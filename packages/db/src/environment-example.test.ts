import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

describe(".env.example", () => {
  it("contains placeholders and no tracked credential or wallet material", () => {
    const value = readFileSync(resolve(process.cwd(), "../../.env.example"), "utf8");
    expect(value).toContain('TXLINE_API_TOKEN="replace-with-activated-txline-api-token"');
    expect(value).toContain('TXLINE_REQUEST_TIMEOUT_MS="30000"');
    expect(value).not.toMatch(/eyJ[A-Za-z0-9_-]{20,}/);
    expect(value).not.toMatch(/\[[\s\d,]{100,}\]/);
    expect(value).not.toMatch(/[A-Z]:\\Users\\/i);
    expect(value).not.toContain("predict9ja_local");
  });
});
