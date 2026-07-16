import { expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  account: vi.fn(),
  simulate: vi.fn(),
}));
vi.mock("../../../session-context", () => ({ currentDemoAccount: mocks.account }));
vi.mock("@predict9ja/db", () => ({ runJudgeDemoSimulation: mocks.simulate }));

import { POST } from "./route";

it("returns a safe error without exposing a raw server failure", async () => {
  mocks.account.mockResolvedValue({ id: "judge-account" });
  mocks.simulate.mockRejectedValue(new Error("postgresql://secret-host/credential"));
  const response = await POST();
  expect(response.status).toBe(503);
  expect(await response.json()).toEqual({ code: "SIMULATION_FAILED" });
});
