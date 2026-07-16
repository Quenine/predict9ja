import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  currentDemoAccount: vi.fn(),
  getJudgeDemoState: vi.fn(),
  fixture: vi.fn(),
}));

vi.mock("./session-context", () => ({ currentDemoAccount: mocks.currentDemoAccount }));
vi.mock("@predict9ja/db", () => ({
  db: {
    fixture: { findUnique: mocks.fixture },
    scoreProofVerification: {
      findFirst: vi
        .fn()
        .mockImplementation((input: { where: { validationStatus?: string } }) =>
          Promise.resolve(input.where.validationStatus ? { providerSequence: 962 } : null),
        ),
    },
  },
  getJudgeDemoState: mocks.getJudgeDemoState,
}));

import { loadJudgePage } from "./page-loaders";

describe("loadJudgePage", () => {
  beforeEach(() => {
    process.env.DATABASE_URL = "configured";
    mocks.fixture.mockResolvedValue({ sourceId: "18241006" });
    mocks.getJudgeDemoState.mockReset();
  });

  it("returns real evidence and isolated synthetic demo state together", async () => {
    mocks.currentDemoAccount.mockResolvedValue({ id: "judge-account" });
    mocks.getJudgeDemoState.mockResolvedValue({ fixture: { sourceMode: "SYNTHETIC" } });
    await expect(loadJudgePage()).resolves.toMatchObject({
      state: "loaded",
      data: {
        fixture: { sourceId: "18241006" },
        verifiedFinal: { providerSequence: 962 },
        demo: { fixture: { sourceMode: "SYNTHETIC" } },
      },
    });
  });

  it("returns a safe no-session demo state", async () => {
    mocks.currentDemoAccount.mockResolvedValue(null);
    await expect(loadJudgePage()).resolves.toMatchObject({
      state: "loaded",
      data: { fixture: { sourceId: "18241006" }, demo: null },
    });
    expect(mocks.getJudgeDemoState).not.toHaveBeenCalled();
  });
});
