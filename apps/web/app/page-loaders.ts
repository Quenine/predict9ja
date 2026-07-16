import {
  db,
  getAccountPortfolio,
  getAdminSummary,
  getJudgeDemoState,
  getReceipt,
  listFixtureMarkets,
  listFixturesWithMarkets,
} from "@predict9ja/db";
import { currentDemoAccount } from "./session-context";
import { requireWebDatabaseEnvironment, safeRuntimeCategory } from "./server-runtime";

export type PageLoadResult<T> =
  | { state: "loaded"; data: T }
  | { state: "not_found" }
  | { state: "no_session" }
  | { state: "failed"; category: string };

async function databaseLoad<T>(load: () => Promise<T>): Promise<PageLoadResult<T>> {
  try {
    requireWebDatabaseEnvironment();
    return { state: "loaded", data: await load() };
  } catch (error) {
    const category = safeRuntimeCategory(error);
    console.error(JSON.stringify({ event: "web.loader.failed", category }));
    return { state: "failed", category };
  }
}

export const loadArenaPage = () => databaseLoad(() => listFixturesWithMarkets());
export const loadAdminPage = () =>
  databaseLoad(async () => {
    await db.$queryRawUnsafe("SELECT 1");
    return getAdminSummary();
  });
export async function loadFixturePage(sourceId: string) {
  const result = await databaseLoad(() => listFixtureMarkets(sourceId));
  if (result.state === "loaded" && !result.data) return { state: "not_found" as const };
  if (result.state !== "loaded") return result;
  let account = null;
  try {
    account = await currentDemoAccount();
  } catch (error) {
    console.error(
      JSON.stringify({ event: "web.loader.failed", category: safeRuntimeCategory(error) }),
    );
  }
  return { state: "loaded" as const, data: { fixture: result.data, account } };
}
export async function loadPortfolioPage() {
  try {
    const account = await currentDemoAccount();
    if (!account) return { state: "no_session" as const };
    return databaseLoad(() => getAccountPortfolio(account.id));
  } catch (error) {
    return { state: "failed" as const, category: safeRuntimeCategory(error) };
  }
}
export async function loadReceiptPage(id: string) {
  const result = await databaseLoad(() => getReceipt(id));
  if (result.state === "loaded" && !result.data) return { state: "not_found" as const };
  return result;
}
export const loadJudgePage = () =>
  databaseLoad(async () => {
    const fixtureSourceId = "18241006";
    const include = { scoreObservation: true, receipt: true } as const;
    const account = await currentDemoAccount();
    const [fixture, verifiedFinal, fallback, demo] = await Promise.all([
      db.fixture.findUnique({ where: { sourceId: fixtureSourceId } }),
      db.scoreProofVerification.findFirst({
        where: {
          fixtureSourceId,
          validationStatus: "VERIFIED",
          observationClassification: "FINAL_MATCH_OBSERVATION",
          scoreObservation: { sourceMode: "LIVE", action: "game_finalised", finalised: true },
        },
        include,
        orderBy: { verifiedAt: "desc" },
      }),
      db.scoreProofVerification.findFirst({
        where: { fixtureSourceId },
        include,
        orderBy: { updatedAt: "desc" },
      }),
      account ? getJudgeDemoState(account.id) : null,
    ]);
    return { fixture, verifiedFinal, fallback, demo };
  });
