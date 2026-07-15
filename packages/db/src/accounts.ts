import { createHash, randomBytes } from "node:crypto";
import { Prisma, type PrismaClient } from "@prisma/client";
import { calculatePosition } from "@predict9ja/domain";
import { db } from "./index";
export const DEMO_SESSION_COOKIE = "predict9ja_demo";
export const INITIAL_DEMO_CREDITS = 10_000;
export const MIN_STAKE = 1;
export const MAX_STAKE = 5_000;
export function hashSessionToken(token: string, secret: string) {
  return createHash("sha256").update(`${secret}:${token}`).digest("hex");
}
export async function createDemoSession(secret: string, client: PrismaClient = db) {
  if (secret.length < 16)
    throw new Error("DEMO_SESSION_SECRET must contain at least 16 characters");
  const token = randomBytes(32).toString("base64url");
  const tokenHash = hashSessionToken(token, secret);
  const account = await client.$transaction(async (tx) => {
    const session = await tx.anonymousSession.create({ data: { tokenHash } });
    const created = await tx.demoAccount.create({
      data: { sessionId: session.id, availableCredits: INITIAL_DEMO_CREDITS },
    });
    await tx.creditLedgerEntry.create({
      data: {
        accountId: created.id,
        amount: INITIAL_DEMO_CREDITS,
        entryType: "SESSION_GRANT",
        reference: `session-grant:${session.id}`,
      },
    });
    return created;
  });
  return { token, account };
}
export async function accountForToken(token: string, secret: string, client: PrismaClient = db) {
  const session = await client.anonymousSession.findFirst({
    where: { tokenHash: hashSessionToken(token, secret), revokedAt: null },
    include: { account: true },
  });
  if (!session?.account) return null;
  await client.anonymousSession.update({
    where: { id: session.id },
    data: { lastSeenAt: new Date() },
  });
  return session.account;
}
export async function revokeDemoSession(token: string, secret: string, client: PrismaClient = db) {
  await client.anonymousSession.updateMany({
    where: { tokenHash: hashSessionToken(token, secret), revokedAt: null },
    data: { revokedAt: new Date() },
  });
}
export async function reconcileAccount(accountId: string, client: PrismaClient = db) {
  const [account, sum] = await Promise.all([
    client.demoAccount.findUniqueOrThrow({ where: { id: accountId } }),
    client.creditLedgerEntry.aggregate({ where: { accountId }, _sum: { amount: true } }),
  ]);
  const ledgerBalance = sum._sum.amount ?? 0;
  return {
    accountId,
    availableCredits: account.availableCredits,
    ledgerBalance,
    reconciled: account.availableCredits === ledgerBalance,
  };
}
export class PurchaseError extends Error {
  constructor(
    public readonly code:
      "INSUFFICIENT_CREDITS" | "STALE_QUOTE" | "MARKET_CLOSED" | "INVALID_REQUEST",
  ) {
    super(code);
    this.name = "PurchaseError";
  }
}
export type PurchaseInput = Readonly<{
  marketId: string;
  outcomeKey: string;
  stakeCredits: number;
  quoteVersion: number;
  idempotencyKey: string;
}>;
export async function purchasePosition(
  accountId: string,
  input: PurchaseInput,
  client: PrismaClient = db,
) {
  if (
    !Number.isSafeInteger(input.stakeCredits) ||
    input.stakeCredits < MIN_STAKE ||
    input.stakeCredits > MAX_STAKE ||
    !/^[A-Za-z0-9_-]{8,80}$/.test(input.idempotencyKey)
  )
    throw new PurchaseError("INVALID_REQUEST");
  return client.$transaction(
    async (tx) => {
      const prior = await tx.demoPurchase.findUnique({
        where: { accountId_idempotencyKey: { accountId, idempotencyKey: input.idempotencyKey } },
      });
      if (prior) return prior;
      const market = await tx.market.findUnique({
        where: { id: input.marketId },
        include: {
          fixture: { include: { scoreProjection: true } },
          outcomes: { include: { quotes: { where: { active: true } } } },
        },
      });
      if (
        !market ||
        market.status !== "ACTIVE" ||
        market.closeAt <= new Date() ||
        market.fixture.scoreProjection?.finalised
      )
        throw new PurchaseError("MARKET_CLOSED");
      const outcome = market.outcomes.find((value) => value.key === input.outcomeKey);
      const quote = outcome?.quotes.find((value) => value.version === input.quoteVersion);
      if (!outcome || !quote) throw new PurchaseError("STALE_QUOTE");
      const calculation = calculatePosition(input.stakeCredits, quote.priceBasisPoints);
      const updated = await tx.demoAccount.updateMany({
        where: { id: accountId, availableCredits: { gte: input.stakeCredits } },
        data: { availableCredits: { decrement: input.stakeCredits } },
      });
      if (updated.count !== 1) throw new PurchaseError("INSUFFICIENT_CREDITS");
      const purchase = await tx.demoPurchase.create({
        data: {
          accountId,
          marketId: market.id,
          outcomeId: outcome.id,
          idempotencyKey: input.idempotencyKey,
          stakeCredits: input.stakeCredits,
          quoteVersion: quote.version,
          priceBasisPoints: quote.priceBasisPoints,
          sharesMicros: BigInt(calculation.sharesMicros),
          potentialPayoutCredits: calculation.potentialPayoutCredits,
        },
      });
      const position = await tx.demoPosition.upsert({
        where: {
          accountId_marketId_outcomeId: { accountId, marketId: market.id, outcomeId: outcome.id },
        },
        create: {
          accountId,
          marketId: market.id,
          outcomeId: outcome.id,
          stakeCredits: input.stakeCredits,
          sharesMicros: BigInt(calculation.sharesMicros),
          potentialPayoutCredits: calculation.potentialPayoutCredits,
        },
        update: {
          stakeCredits: { increment: input.stakeCredits },
          sharesMicros: { increment: BigInt(calculation.sharesMicros) },
          potentialPayoutCredits: { increment: calculation.potentialPayoutCredits },
        },
      });
      await tx.creditLedgerEntry.create({
        data: {
          accountId,
          amount: -input.stakeCredits,
          entryType: "POSITION_PURCHASE",
          reference: `purchase:${purchase.id}`,
          marketId: market.id,
          positionId: position.id,
        },
      });
      return purchase;
    },
    { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
  );
}
export function getAccountPortfolio(accountId: string, client: PrismaClient = db) {
  return client.demoAccount.findUnique({
    where: { id: accountId },
    include: {
      positions: {
        include: { market: { include: { fixture: true, receipt: true } }, outcome: true },
        orderBy: { createdAt: "desc" },
      },
      ledgerEntries: { orderBy: { createdAt: "desc" }, take: 50 },
    },
  });
}
