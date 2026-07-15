import { db } from "@predict9ja/db";
const sourceId = "synthetic-kora-savanna-001";
const fixture = await db.fixture.findUniqueOrThrow({
  where: { sourceId },
  include: { markets: true },
});
await db.$transaction(async (tx) => {
  await tx.creditLedgerEntry.deleteMany({ where: { accountId: "cli-demo-account" } });
  await tx.demoPurchase.deleteMany({ where: { accountId: "cli-demo-account" } });
  await tx.demoPosition.deleteMany({ where: { accountId: "cli-demo-account" } });
  await tx.demoAccount.deleteMany({ where: { id: "cli-demo-account" } });
  await tx.resolutionReceipt.deleteMany({ where: { market: { fixtureId: fixture.id } } });
  await tx.marketLifecycleAudit.deleteMany({ where: { market: { fixtureId: fixture.id } } });
  await tx.market.updateMany({
    where: { fixtureId: fixture.id },
    data: {
      status: "ACTIVE",
      settlementStatus: "PENDING",
      closeAt: new Date(Date.now() + 3_600_000),
    },
  });
  await tx.fixtureScoreProjection.update({
    where: { fixtureId: fixture.id },
    data: {
      latestSequence: 1,
      latestAction: "phase_update",
      latestPhase: "NOT_STARTED",
      participant1Goals: null,
      participant2Goals: null,
      finalised: false,
    },
  });
  await tx.replayScoreState.upsert({
    where: { fixtureId: fixture.id },
    create: { fixtureId: fixture.id },
    update: {
      latestSequence: null,
      phase: "UNKNOWN",
      participant1Goals: null,
      participant2Goals: null,
      finalised: false,
      status: "IDLE",
    },
  });
  const account = await tx.demoAccount.create({
    data: { id: "cli-demo-account", label: "Synthetic CLI demonstration", availableCredits: 10000 },
  });
  await tx.creditLedgerEntry.create({
    data: {
      accountId: account.id,
      amount: 10000,
      entryType: "ADMIN_RESET",
      reference: `admin-reset:${account.id}`,
    },
  });
});
console.log(
  JSON.stringify({
    fixtureId: sourceId,
    accountId: "cli-demo-account",
    balance: 10000,
    synthetic: true,
  }),
);
