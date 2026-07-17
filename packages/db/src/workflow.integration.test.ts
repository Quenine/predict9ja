import { PrismaClient } from "@prisma/client";
import { afterAll, beforeEach, describe, expect, it } from "vitest";
import {
  createDemoSession,
  generateMarketsForFixture,
  hashSessionToken,
  importScoreHistory,
  initializeJudgeDemo,
  initializeJudgeMode,
  getJudgeReceiptContext,
  getFixtureCatalogue,
  persistScore,
  purchasePosition,
  reconcileAccount,
  resolveFixture,
  runJudgeDemoSimulation,
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

async function judgeTemplate() {
  const created = await fixture("synthetic-kora-savanna-001");
  await client.scoreObservation.createMany({
    data: [
      [1, "phase_update", "NOT_STARTED", null, null, false],
      [2, "score_update", "FIRST_HALF", 1, 0, false],
      [3, "phase_update", "HALFTIME", 1, 0, false],
      [4, "score_update", "SECOND_HALF", 1, 1, false],
      [5, "phase_update", "FINISHED", 1, 1, false],
      [6, "game_finalised", "FINISHED", 1, 1, true],
    ].map(([providerSequence, action, phase, participant1Goals, participant2Goals, finalised]) => ({
      fixtureId: created.id,
      providerSequence: providerSequence as number,
      providerTimestamp: new Date(`2026-06-15T19:0${providerSequence as number}:00Z`),
      action: action as string,
      phase: phase as string,
      participant1Goals: participant1Goals as number | null,
      participant2Goals: participant2Goals as number | null,
      finalised: finalised as boolean,
      sourceMode: "SYNTHETIC" as const,
    })),
  });
}

describe("browser judge demo", () => {
  it("initializes an isolated demo idempotently with exactly 10,000 reconciled credits", async () => {
    await judgeTemplate();
    const account = (await createDemoSession("integration-secret-value", client)).account;
    await initializeJudgeDemo(account.id, client);
    await initializeJudgeDemo(account.id, client);
    expect(await reconcileAccount(account.id, client)).toMatchObject({
      availableCredits: 10_000,
      ledgerBalance: 10_000,
      reconciled: true,
    });
    expect(await client.creditLedgerEntry.count({ where: { accountId: account.id } })).toBe(1);
    expect(await client.fixture.count({ where: { sourceId: `judge-demo-${account.id}` } })).toBe(1);
  });

  it("purchases the selected stake at the active quote and rejects insufficient credits", async () => {
    await judgeTemplate();
    const account = (await createDemoSession("integration-secret-value", client)).account;
    const state = await initializeJudgeDemo(account.id, client);
    const market = state!.fixture.markets.find((value) => value.ruleVersion === "match-result@1")!;
    const outcome = market.outcomes.find((value) => value.key === "DRAW")!;
    const quote = outcome.quotes[0]!;
    const purchase = await purchasePosition(
      account.id,
      {
        marketId: market.id,
        outcomeKey: outcome.key,
        stakeCredits: 2_000,
        quoteVersion: quote.version,
        idempotencyKey: "judge-active-quote",
      },
      client,
    );
    expect(purchase).toMatchObject({ stakeCredits: 2_000, quoteVersion: quote.version });
    await purchasePosition(
      account.id,
      {
        marketId: market.id,
        outcomeKey: outcome.key,
        stakeCredits: 5_000,
        quoteVersion: quote.version,
        idempotencyKey: "judge-second-buy",
      },
      client,
    );
    await expect(
      purchasePosition(
        account.id,
        {
          marketId: market.id,
          outcomeKey: outcome.key,
          stakeCredits: 5_000,
          quoteVersion: quote.version,
          idempotencyKey: "judge-over-balance",
        },
        client,
      ),
    ).rejects.toMatchObject({ code: "INSUFFICIENT_CREDITS" });
  });

  it("finalises only the isolated synthetic fixture and settles 1-1 idempotently", async () => {
    await judgeTemplate();
    const real = await fixture("18241006");
    const proof = await client.scoreProofVerification.create({
      data: {
        fixtureId: real.id,
        fixtureSourceId: real.sourceId,
        providerSequence: 962,
        network: "devnet",
        statKeys: [1, 2],
        statKeyIdentity: "1,2",
        validationStatus: "VERIFIED",
        observationClassification: "FINAL_MATCH_OBSERVATION",
        settlementEvidenceClassification: "FINAL_DATA_VERIFIED_NO_RECEIPT",
      },
    });
    const account = (await createDemoSession("integration-secret-value", client)).account;
    const state = await initializeJudgeDemo(account.id, client);
    const market = state!.fixture.markets.find((value) => value.ruleVersion === "match-result@1")!;
    const draw = market.outcomes.find((value) => value.key === "DRAW")!;
    await purchasePosition(
      account.id,
      {
        marketId: market.id,
        outcomeKey: "DRAW",
        stakeCredits: 1_000,
        quoteVersion: draw.quotes[0]!.version,
        idempotencyKey: "judge-winning-draw",
      },
      client,
    );
    const first = await runJudgeDemoSimulation(account.id, undefined, client);
    const balanceAfterFirst = first.state!.account.availableCredits;
    const second = await runJudgeDemoSimulation(account.id, undefined, client);
    expect(second.state!.account.availableCredits).toBe(balanceAfterFirst);
    expect(second.reconciliation.reconciled).toBe(true);
    expect(second.state!.fixture.scoreProjection).toMatchObject({
      latestAction: "game_finalised",
      participant1Goals: 1,
      participant2Goals: 1,
      finalised: true,
    });
    expect(second.state!.fixture.markets.map((value) => value.receipt?.winningOutcomeKey)).toEqual([
      "DRAW",
      "UNDER",
      "YES",
    ]);
    expect(
      await client.fixtureScoreProjection.findUnique({ where: { fixtureId: real.id } }),
    ).toBeNull();
    expect(await client.resolutionReceipt.count({ where: { proofVerificationId: proof.id } })).toBe(
      0,
    );
  });
});

async function realReplayTemplate() {
  const canonical = await client.fixture.create({
    data: {
      sourceId: "18241006",
      sourceMode: "LIVE",
      homeTeam: "England",
      awayTeam: "Argentina",
      participant1Name: "England",
      participant2Name: "Argentina",
      participant1IsHome: true,
      startsAt: new Date("2026-06-01T18:00:00Z"),
      status: "FINISHED",
      scoreObservations: {
        create: [
          {
            providerSequence: 960,
            providerTimestamp: new Date("2026-06-01T19:40:00Z"),
            action: "score_update",
            phase: "SECOND_HALF",
            participant1Goals: 1,
            participant2Goals: 1,
            finalised: false,
            sourceMode: "LIVE",
          },
          {
            providerSequence: 962,
            providerTimestamp: new Date("2026-06-01T19:51:00Z"),
            action: "game_finalised",
            phase: "UNKNOWN",
            participant1Goals: 1,
            participant2Goals: 2,
            finalised: true,
            sourceMode: "LIVE",
          },
          {
            providerSequence: 963,
            providerTimestamp: new Date("2026-06-01T19:52:00Z"),
            action: "score_update",
            phase: "UNKNOWN",
            participant1Goals: 9,
            participant2Goals: 9,
            finalised: false,
            sourceMode: "LIVE",
          },
        ],
      },
    },
  });
  const finalObservation = await client.scoreObservation.findUniqueOrThrow({
    where: { fixtureId_providerSequence: { fixtureId: canonical.id, providerSequence: 962 } },
  });
  const proof = await client.scoreProofVerification.create({
    data: {
      fixtureId: canonical.id,
      fixtureSourceId: canonical.sourceId,
      providerSequence: 962,
      scoreObservationId: finalObservation.id,
      network: "devnet",
      statKeys: [1, 2],
      statValues: [1, 2],
      statKeyIdentity: "1,2",
      proofPayloadDigest: "0abc3af2ebb38623b3d2e89ebb4e19071e4b867be814c7107d0fa7d8921808a7",
      programId: "6pW64gN1s2uqjHkn1unFeEjAwJkPGHoppGvS715wyP2J",
      dailyScoresPda: "HJ6nSVkUs4VG9JQ5sEUq3VbmyUSBf76ePXUCATLtRYTX",
      fetchStatus: "FETCHED",
      validationStatus: "VERIFIED",
      observationClassification: "FINAL_MATCH_OBSERVATION",
      settlementEvidenceClassification: "FINAL_DATA_VERIFIED_NO_RECEIPT",
    },
  });
  return { canonical, proof };
}

describe("real TxLINE judge replay", () => {
  it("isolates observations through 962, settles 1-2 idempotently and preserves canonical evidence", async () => {
    const { canonical, proof } = await realReplayTemplate();
    const canonicalBefore = await client.scoreObservation.findMany({
      where: { fixtureId: canonical.id },
      orderBy: { providerSequence: "asc" },
    });
    const account = (await createDemoSession("integration-secret-value", client)).account;
    const other = (await createDemoSession("integration-secret-value", client)).account;
    const state = await initializeJudgeMode(account.id, "REPLAY", client);
    const otherState = await initializeJudgeMode(other.id, "REPLAY", client);
    expect(state).toMatchObject({ mode: "REPLAY", canonicalSourceId: "18241006" });
    expect(state!.fixture.sourceMode).toBe("REPLAY");
    expect(state!.fixture.sourceId).toBe(`judge-replay:18241006:${account.id}`);
    expect(otherState!.fixture.sourceId).not.toBe(state!.fixture.sourceId);
    expect(state!.fixture.scoreObservations.map((value) => value.providerSequence)).toEqual([
      960, 962,
    ]);
    const catalogue = await getFixtureCatalogue(client);
    expect(catalogue.fixtures.some((value) => value.sourceId === canonical.sourceId)).toBe(true);
    expect(catalogue.fixtures.some((value) => value.sourceMode === "REPLAY")).toBe(false);
    expect(
      await client.scoreObservation.findMany({
        where: { fixtureId: canonical.id },
        orderBy: { providerSequence: "asc" },
      }),
    ).toEqual(canonicalBefore);
    const market = state!.fixture.markets.find((value) => value.ruleVersion === "match-result@1")!;
    const away = market.outcomes.find((value) => value.key === "AWAY")!;
    await purchasePosition(
      account.id,
      {
        marketId: market.id,
        outcomeKey: "AWAY",
        stakeCredits: 1_000,
        quoteVersion: away.quotes[0]!.version,
        idempotencyKey: "real-replay-away",
      },
      client,
    );
    const first = await runJudgeDemoSimulation(account.id, "REPLAY", client);
    const second = await runJudgeDemoSimulation(account.id, "REPLAY", client);
    expect(first.state!.fixture.scoreProjection).toMatchObject({
      latestSequence: 962,
      latestAction: "game_finalised",
      participant1Goals: 1,
      participant2Goals: 2,
      finalised: true,
    });
    expect(first.state!.fixture.markets.map((value) => value.receipt?.winningOutcomeKey)).toEqual([
      "AWAY",
      "OVER",
      "YES",
    ]);
    expect(second.state!.account.availableCredits).toBe(first.state!.account.availableCredits);
    expect(second.reconciliation.reconciled).toBe(true);
    const receiptId = first.state!.fixture.markets[0]!.receipt!.id;
    const context = await getJudgeReceiptContext(receiptId, account.id, client);
    expect(context).toMatchObject({
      receiptContext: "HISTORICAL_REPLAY",
      canonicalSourceId: "18241006",
      replaySourceEvidence: {
        id: proof.id,
        validationStatus: "VERIFIED",
        settlementEvidenceClassification: "FINAL_DATA_VERIFIED_NO_RECEIPT",
      },
    });
    expect(await getJudgeReceiptContext(receiptId, other.id, client)).toBeNull();
    expect(await client.resolutionReceipt.count({ where: { proofVerificationId: proof.id } })).toBe(
      0,
    );
    expect(
      await client.scoreProofVerification.findUniqueOrThrow({ where: { id: proof.id } }),
    ).toMatchObject({
      validationStatus: "VERIFIED",
      settlementEvidenceClassification: "FINAL_DATA_VERIFIED_NO_RECEIPT",
      proofPayloadDigest: "0abc3af2ebb38623b3d2e89ebb4e19071e4b867be814c7107d0fa7d8921808a7",
    });
  });
});
