import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { expect, it } from "vitest";
import { TXLINE_LOCAL_DIAGNOSTIC_GUARD } from "./validation-provider";

it("keeps the documented diagnostic guard aligned with implementation", () => {
  const example = readFileSync(resolve(process.cwd(), "../../.env.example"), "utf8");
  expect(example).toContain(`TXLINE_VALIDATION_DIAGNOSTIC="${TXLINE_LOCAL_DIAGNOSTIC_GUARD}"`);
});
