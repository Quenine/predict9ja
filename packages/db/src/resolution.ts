import { createHash } from "node:crypto";
import { Prisma, type PrismaClient } from "@prisma/client";
import { canonicalReceiptFields, resolveMarket } from "@predict9ja/domain";
import { db } from "./index";
export function receiptDigest(fields: Readonly<Record<string, string | number | boolean | null>>) {
  return createHash("sha256").update(canonicalReceiptFields(fields)).digest("hex");
}
export async function previewFixtureResolution(sourceId: string, client: PrismaClient = db) {
  const fixture = await client.fixture.findUnique({
    where: { sourceId },
    include: {
      scoreProjection: true,
      scoreObservations: {
        where: { finalised: true, action: "game_finalised" },
        orderBy: { providerSequence: "desc" },
        take: 1,
      },
      markets: { orderBy: { displayOrder: "asc" } },
    },
  });
  if (!fixture?.scoreProjection?.finalised || !fixture.scoreObservations[0])
    throw new Error("Explicit finalisation observation is required");
  const observation = fixture.scoreObservations[0];
  if (observation.participant1Goals === null || observation.participant2Goals === null)
    throw new Error("Final score is incomplete");
  return {
    fixture,
    observation,
    resolutions: fixture.markets
      .filter((market) => market.status !== "VOID")
      .map((market) => ({
        market,
        output: resolveMarket({
          ruleVersion: market.ruleVersion,
          participant1Goals: observation.participant1Goals!,
          participant2Goals: observation.participant2Goals!,
          participant1IsHome: fixture.participant1IsHome,
          finalised: true,
        }),
      })),
  };
}
export async function resolveFixture(sourceId: string, commit: boolean, client: PrismaClient = db) {
  const preview = await previewFixtureResolution(sourceId, client);
  if (!commit)
    return {
      committed: false,
      receipts: preview.resolutions.map((value) => ({
        marketId: value.market.id,
        winningOutcomeKey: value.output.winningOutcomeKey,
      })),
    };
  const receiptIds: string[] = [];
  for (const { market, output } of preview.resolutions) {
    const receipt = await client.$transaction(
      async (tx) => {
        const existing = await tx.resolutionReceipt.findUnique({ where: { marketId: market.id } });
        if (existing) return existing;
        const previous = market.status;
        if (previous === "ACTIVE") {
          await tx.market.update({ where: { id: market.id }, data: { status: "CLOSED" } });
          await tx.marketLifecycleAudit.create({
            data: {
              marketId: market.id,
              previousStatus: "ACTIVE",
              newStatus: "CLOSED",
              reasonCode: "FINALISATION_OBSERVED",
              actorType: "WORKER",
            },
          });
        }
        if (previous === "ACTIVE" || previous === "CLOSED") {
          await tx.market.update({
            where: { id: market.id },
            data: { status: "RESOLUTION_READY" },
          });
          await tx.marketLifecycleAudit.create({
            data: {
              marketId: market.id,
              previousStatus: "CLOSED",
              newStatus: "RESOLUTION_READY",
              reasonCode: "EXPLICIT_FINALISATION",
              actorType: "WORKER",
            },
          });
        }
        const fields = {
          fixtureId: preview.fixture.id,
          marketId: market.id,
          ruleVersion: market.ruleVersion,
          winningOutcomeKey: output.winningOutcomeKey,
          finalObservationId: preview.observation.id,
          providerSequence: preview.observation.providerSequence,
          providerTimestamp: preview.observation.providerTimestamp.toISOString(),
          sourceMode: preview.observation.sourceMode,
          scoreAction: preview.observation.action,
          participant1Goals: preview.observation.participant1Goals!,
          participant2Goals: preview.observation.participant2Goals!,
          participant1IsHome: preview.fixture.participant1IsHome,
          resolutionStatus: "RESOLVED",
          settlementStatus: "PENDING",
          proofStatus: "NOT_REQUESTED",
        } as const;
        const created = await tx.resolutionReceipt.create({
          data: {
            marketId: market.id,
            winningOutcomeKey: output.winningOutcomeKey,
            settlementStatus: "PENDING",
            proofStatus: "NOT_REQUESTED",
            proofHash: null,
            homeScore: preview.fixture.participant1IsHome
              ? preview.observation.participant1Goals
              : preview.observation.participant2Goals,
            awayScore: preview.fixture.participant1IsHome
              ? preview.observation.participant2Goals
              : preview.observation.participant1Goals,
            resolvedAt: new Date(),
            fixtureId: preview.fixture.id,
            ruleVersion: market.ruleVersion,
            finalObservationId: preview.observation.id,
            providerSequence: preview.observation.providerSequence,
            providerTimestamp: preview.observation.providerTimestamp,
            sourceMode: preview.observation.sourceMode,
            scoreAction: preview.observation.action,
            participant1Goals: preview.observation.participant1Goals,
            participant2Goals: preview.observation.participant2Goals,
            participant1IsHome: preview.fixture.participant1IsHome,
            resolutionStatus: "RESOLVED",
            integrityDigest: receiptDigest(fields),
          },
        });
        await tx.market.update({ where: { id: market.id }, data: { status: "RESOLVED" } });
        await tx.marketLifecycleAudit.create({
          data: {
            marketId: market.id,
            previousStatus: "RESOLUTION_READY",
            newStatus: "RESOLVED",
            reasonCode: "RULE_EVALUATED",
            actorType: "WORKER",
          },
        });
        return created;
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
    );
    receiptIds.push(receipt.id);
  }
  return { committed: true, receipts: receiptIds };
}
export async function settleFixture(sourceId: string, client: PrismaClient = db) {
  const markets = await client.market.findMany({
    where: { fixture: { sourceId }, status: { in: ["RESOLVED", "VOID"] } },
    include: { receipt: true, demoPositions: true },
  });
  let payouts = 0,
    refunds = 0;
  for (const market of markets)
    await client.$transaction(
      async (tx) => {
        for (const position of market.demoPositions) {
          if (position.settledAt) continue;
          const isVoid = market.status === "VOID";
          const amount = isVoid
            ? position.stakeCredits
            : position.outcomeId ===
                (
                  await tx.marketOutcome.findFirst({
                    where: { marketId: market.id, key: market.receipt?.winningOutcomeKey ?? "" },
                    select: { id: true },
                  })
                )?.id
              ? position.potentialPayoutCredits
              : 0;
          if (amount > 0) {
            const reference = `${isVoid ? "void-refund" : "settlement-payout"}:${position.id}`;
            const exists = await tx.creditLedgerEntry.findUnique({ where: { reference } });
            if (!exists) {
              await tx.demoAccount.update({
                where: { id: position.accountId },
                data: { availableCredits: { increment: amount } },
              });
              await tx.creditLedgerEntry.create({
                data: {
                  accountId: position.accountId,
                  amount,
                  entryType: isVoid ? "VOID_REFUND" : "SETTLEMENT_PAYOUT",
                  reference,
                  marketId: market.id,
                  positionId: position.id,
                  receiptId: market.receipt?.id ?? null,
                },
              });
              if (isVoid) refunds += amount;
              else payouts += amount;
            }
          }
          await tx.demoPosition.update({
            where: { id: position.id },
            data: { actualPayoutCredits: amount, settledAt: new Date() },
          });
        }
        await tx.market.update({
          where: { id: market.id },
          data: { settlementStatus: market.status === "VOID" ? "VOID" : "SETTLED" },
        });
        if (market.receipt)
          await tx.resolutionReceipt.update({
            where: { id: market.receipt.id },
            data: { settlementStatus: market.status === "VOID" ? "VOID" : "SETTLED" },
          });
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
    );
  return { markets: markets.length, payouts, refunds };
}
export function getReceipt(receiptId: string, client: PrismaClient = db) {
  return client.resolutionReceipt.findUnique({
    where: { id: receiptId },
    include: {
      market: { include: { fixture: true } },
      proofVerification: { include: { scoreObservation: true } },
    },
  });
}
