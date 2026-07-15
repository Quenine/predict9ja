import { PrismaClient } from "@prisma/client";
import { afterAll, beforeEach, describe, expect, it } from "vitest";
import {
  createDemoSession,
  generateMarketsForFixture,
  hashSessionToken,
  importScoreHistory,
  persistScore,
  purchasePosition,
  reconcileAccount,
  resolveFixture,
  settleFixture,
  ScoreIntegrityError,
} from "./index";
const url = process.env.DATABASE_TEST_URL ?? process.env.DATABASE_URL;
if (!url || !new URL(url).pathname.toLowerCase().includes("test"))
  throw new Error("Integration tests require DATABASE_TEST_URL pointing to a test database");
const client = new PrismaClient({ datasources: { db: { url } } });
async function reset() {
  await client.$executeRawUnsafe(
    'TRUNCATE TABLE "CreditLedgerEntry", "DemoPurchase", "DemoPosition", "OutcomeQuote", "MarketLifecycleAudit", "ResolutionReceipt", "AnonymousSession", "DemoAccount", "ScoreObservation", "FixtureScoreProjection", "ReplayScoreState", "MarketOutcome", "Market", "Fixture", "FeedCheckpoint", "Position", "Trade", "DemoUser" RESTART IDENTITY CASCADE',
  );
}
async function fixture(sourceId = "integration-fixture", participant1IsHome = true) {
  return client.fixture.create({
    data: {
      sourceId,
      sourceMode: "SYNTHETIC",
      homeTeam: participant1IsHome ? "P1" : "P2",
      awayTeam: participant1IsHome ? "P2" : "P1",
      participant1Name: "P1",
      participant2Name: "P2",
      participant1IsHome,
      startsAt: new Date(Date.now() + 3_600_000),
      status: "SCHEDULED",
    },
  });
}
const score = (
  sequence: number,
  goals1: number | null,
  goals2: number | null,
  finalised = false,
) => ({
  fixtureSourceId: "integration-fixture",
  sequence,
  providerTimestamp: new Date(`2026-01-01T00:00:0${sequence}Z`),
  action: finalised ? ("game_finalised" as const) : ("score_update" as const),
  phase: finalised ? ("FINISHED" as const) : ("FIRST_HALF" as const),
  period: null,
  participant1Goals: goals1,
  participant2Goals: goals2,
  finalised,
  sourceMode: "SYNTHETIC" as const,
});
beforeEach(reset);
afterAll(() => client.$disconnect());
describe("score persistence", () => {
  it("creates observation/projection and treats an identical duplicate idempotently", async () => {
    await fixture();
    expect(await persistScore(score(1, 1, 0), undefined, client)).toBe("applied");
    expect(await persistScore(score(1, 1, 0), undefined, client)).toBe("duplicate");
    expect(await client.scoreObservation.count()).toBe(1);
    expect((await client.fixtureScoreProjection.findFirst())?.latestSequence).toBe(1);
  });
  it("rejects conflicts, advances newer, and never regresses from older", async () => {
    await fixture();
    await persistScore(score(2, 2, 0), undefined, client);
    await expect(persistScore(score(2, 1, 0), undefined, client)).rejects.toBeInstanceOf(
      ScoreIntegrityError,
    );
    await persistScore(score(3, 2, 1, true), undefined, client);
    await persistScore(score(1, 0, 0), undefined, client);
    const projection = await client.fixtureScoreProjection.findFirst();
    expect(projection).toMatchObject({ latestSequence: 3, finalised: true });
  });
  it("imports history idempotently and does not advance a checkpoint after failure", async () => {
    await fixture();
    const values = [score(2, 1, 0), score(1, 0, 0)];
    await importScoreHistory(values, client);
    await importScoreHistory(values, client);
    expect(await client.scoreObservation.count()).toBe(2);
    await expect(persistScore(score(2, 9, 0), "bad", client)).rejects.toThrow();
    expect(await client.feedCheckpoint.count()).toBe(0);
  });
  it("keeps canonical observations unchanged when replay state changes", async () => {
    const created = await fixture();
    await importScoreHistory([score(1, 0, 0), score(2, 1, 0), score(3, 1, 1, true)], client);
    const before = await client.scoreObservation.findMany({ orderBy: { providerSequence: "asc" } });
    for (const item of before)
      await client.replayScoreState.upsert({
        where: { fixtureId: created.id },
        create: { fixtureId: created.id, latestSequence: item.providerSequence, phase: item.phase },
        update: { latestSequence: item.providerSequence, phase: item.phase },
      });
    expect(
      await client.scoreObservation.findMany({ orderBy: { providerSequence: "asc" } }),
    ).toEqual(before);
  });
});
describe("sessions and ledger", () => {
  it("grants isolated accounts and stores only token hashes", async () => {
    const one = await createDemoSession("integration-secret-value", client);
    const two = await createDemoSession("integration-secret-value", client);
    expect(one.account.id).not.toBe(two.account.id);
    expect(await client.anonymousSession.findFirst({ where: { tokenHash: one.token } })).toBeNull();
    expect(hashSessionToken(one.token, "integration-secret-value")).toHaveLength(64);
    expect((await reconcileAccount(one.account.id, client)).reconciled).toBe(true);
  });
  it("conditionally debits, preserves quote version, and deduplicates purchases", async () => {
    const created = await fixture();
    const account = (await createDemoSession("integration-secret-value", client)).account;
    const market = await client.market.create({
      data: {
        fixtureId: created.id,
        type: "MATCH_RESULT",
        title: "Test",
        status: "ACTIVE",
        ruleVersion: "match-result@1",
        closeAt: new Date(Date.now() + 3_600_000),
        outcomes: {
          create: [
            { key: "HOME", label: "Home" },
            { key: "DRAW", label: "Draw" },
            { key: "AWAY", label: "Away" },
          ],
        },
      },
      include: { outcomes: true },
    });
    const outcome = market.outcomes[0]!;
    await client.outcomeQuote.create({
      data: {
        marketId: market.id,
        outcomeId: outcome.id,
        version: 7,
        priceBasisPoints: 4500,
        source: "SYNTHETIC",
      },
    });
    const input = {
      marketId: market.id,
      outcomeKey: outcome.key,
      stakeCredits: 100,
      quoteVersion: 7,
      idempotencyKey: "integration-buy-1",
    };
    const first = await purchasePosition(account.id, input, client);
    const second = await purchasePosition(account.id, input, client);
    expect(second.id).toBe(first.id);
    expect(first.quoteVersion).toBe(7);
    expect((await reconcileAccount(account.id, client)).reconciled).toBe(true);
    expect(
      (await client.demoAccount.findUniqueOrThrow({ where: { id: account.id } })).availableCredits,
    ).toBe(9900);
  });
});
describe("resolution and settlement", () => {
  it("resolves from explicit finalisation and pays winners only once", async () => {
    await fixture();
    await generateMarketsForFixture("integration-fixture", "SYNTHETIC", client);
    const account = (await createDemoSession("integration-secret-value", client)).account;
    const market = await client.market.findFirstOrThrow({
      where: { ruleVersion: "match-result@1" },
      include: { outcomes: { include: { quotes: true } } },
    });
    for (const key of ["HOME", "AWAY"] as const) {
      const outcome = market.outcomes.find((value) => value.key === key)!;
      await purchasePosition(
        account.id,
        {
          marketId: market.id,
          outcomeKey: key,
          stakeCredits: 100,
          quoteVersion: outcome.quotes[0]!.version,
          idempotencyKey: `settlement-${key.toLowerCase()}`,
        },
        client,
      );
    }
    await persistScore(score(1, 2, 1, true), undefined, client);
    const firstResolution = await resolveFixture("integration-fixture", true, client);
    const repeatedResolution = await resolveFixture("integration-fixture", true, client);
    expect(repeatedResolution).toEqual(firstResolution);
    const first = await settleFixture("integration-fixture", client);
    const second = await settleFixture("integration-fixture", client);
    expect(first.payouts).toBeGreaterThan(0);
    expect(second.payouts).toBe(0);
    expect((await reconcileAccount(account.id, client)).reconciled).toBe(true);
    expect(await client.resolutionReceipt.count()).toBe(3);
  });
  it("refunds a void position once", async () => {
    const created = await fixture();
    const account = (await createDemoSession("integration-secret-value", client)).account;
    const market = await client.market.create({
      data: {
        fixtureId: created.id,
        type: "MATCH_RESULT",
        title: "Void",
        status: "VOID",
        settlementStatus: "PENDING",
        ruleVersion: "match-result@1",
        closeAt: new Date(),
        outcomes: { create: [{ key: "HOME", label: "Home" }] },
      },
      include: { outcomes: true },
    });
    await client.demoPosition.create({
      data: {
        accountId: account.id,
        marketId: market.id,
        outcomeId: market.outcomes[0]!.id,
        stakeCredits: 75,
        sharesMicros: 1000000n,
        potentialPayoutCredits: 1,
      },
    });
    await client.demoAccount.update({
      where: { id: account.id },
      data: { availableCredits: { decrement: 75 } },
    });
    await client.creditLedgerEntry.create({
      data: {
        accountId: account.id,
        amount: -75,
        entryType: "POSITION_PURCHASE",
        reference: "void-purchase",
        marketId: market.id,
      },
    });
    expect((await settleFixture("integration-fixture", client)).refunds).toBe(75);
    expect((await settleFixture("integration-fixture", client)).refunds).toBe(0);
    expect((await reconcileAccount(account.id, client)).reconciled).toBe(true);
  });
});
