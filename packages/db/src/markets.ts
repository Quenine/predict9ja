import type { PrismaClient, QuoteSource } from "@prisma/client";
import { createMarketTemplates, validateQuotePrices } from "@predict9ja/domain";
import { db } from "./index";
const quotePrices: Readonly<Record<string, readonly number[]>> = {
  "match-result@1": [4500, 2800, 2700],
  "total-goals-2.5@1": [5200, 4800],
  "both-teams-to-score@1": [5400, 4600],
};
export async function generateMarketsForFixture(
  sourceId: string,
  source: QuoteSource = "SYNTHETIC",
  client: PrismaClient = db,
) {
  const fixture = await client.fixture.findUnique({ where: { sourceId } });
  if (!fixture) throw new Error("Fixture not found");
  if (fixture.status === "CANCELLED") return { created: 0, existing: 0, skipped: 3 };
  let created = 0,
    existing = 0;
  for (const [displayOrder, template] of createMarketTemplates(
    fixture.homeTeam,
    fixture.awayTeam,
  ).entries()) {
    const prior = await client.market.findUnique({
      where: {
        fixtureId_ruleVersion: { fixtureId: fixture.id, ruleVersion: template.ruleVersion },
      },
    });
    if (prior) {
      existing++;
      continue;
    }
    const prices = quotePrices[template.ruleVersion];
    if (!prices || !validateQuotePrices(prices))
      throw new Error("Invalid synthetic quote template");
    await client.$transaction(async (tx) => {
      const market = await tx.market.create({
        data: {
          fixtureId: fixture.id,
          type: template.type,
          title: template.title,
          status: "DRAFT",
          ruleVersion: template.ruleVersion,
          displayOrder,
          closeAt: fixture.startsAt,
          outcomes: {
            create: template.outcomes.map((outcome) => ({
              key: outcome.key,
              label: outcome.label,
            })),
          },
        },
        include: { outcomes: { orderBy: { id: "asc" } } },
      });
      for (const [index, outcome] of market.outcomes.entries())
        await tx.outcomeQuote.create({
          data: {
            marketId: market.id,
            outcomeId: outcome.id,
            version: 1,
            priceBasisPoints: prices[index]!,
            source,
          },
        });
      await tx.market.update({ where: { id: market.id }, data: { status: "ACTIVE" } });
      await tx.marketLifecycleAudit.create({
        data: {
          marketId: market.id,
          previousStatus: "DRAFT",
          newStatus: "ACTIVE",
          reasonCode: "VALID_QUOTES_CREATED",
          actorType: "SYSTEM",
        },
      });
    });
    created++;
  }
  return { created, existing, skipped: 0 };
}
export async function generateAllMarkets(client: PrismaClient = db) {
  const fixtures = await client.fixture.findMany({ select: { sourceId: true } });
  const total = { created: 0, existing: 0, skipped: 0 };
  for (const fixture of fixtures) {
    const result = await generateMarketsForFixture(fixture.sourceId, "SYNTHETIC", client);
    total.created += result.created;
    total.existing += result.existing;
    total.skipped += result.skipped;
  }
  return total;
}
export function listFixtureMarkets(sourceId: string, client: PrismaClient = db) {
  return client.fixture.findUnique({
    where: { sourceId },
    include: {
      scoreProjection: true,
      replayState: true,
      scoreObservations: { orderBy: { providerSequence: "desc" }, take: 20 },
      markets: {
        orderBy: { displayOrder: "asc" },
        include: {
          outcomes: {
            include: { quotes: { where: { active: true }, orderBy: { version: "desc" }, take: 1 } },
          },
          receipt: true,
        },
      },
    },
  });
}
