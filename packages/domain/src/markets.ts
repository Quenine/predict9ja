export const MICROSHARES_PER_SHARE = 1_000_000;
export const BASIS_POINTS = 10_000;
export type MarketLifecycle =
  "DRAFT" | "ACTIVE" | "CLOSED" | "RESOLUTION_READY" | "RESOLVED" | "VOID";
export type SupportedRule = "match-result@1" | "total-goals-2.5@1" | "both-teams-to-score@1";
export type ResolutionInput = Readonly<{
  ruleVersion: string;
  participant1Goals: number;
  participant2Goals: number;
  participant1IsHome: boolean;
  finalised: boolean;
}>;
export type ResolutionOutput = Readonly<{ winningOutcomeKey: string; ruleVersion: SupportedRule }>;

const transitions: Readonly<Record<MarketLifecycle, readonly MarketLifecycle[]>> = {
  DRAFT: ["ACTIVE", "VOID"],
  ACTIVE: ["CLOSED", "VOID"],
  CLOSED: ["RESOLUTION_READY", "VOID"],
  RESOLUTION_READY: ["RESOLVED", "VOID"],
  RESOLVED: [],
  VOID: [],
};
export function canTransitionMarketLifecycle(from: MarketLifecycle, to: MarketLifecycle) {
  return transitions[from].includes(to);
}
export function calculatePosition(stakeCredits: number, priceBasisPoints: number) {
  if (!Number.isSafeInteger(stakeCredits) || stakeCredits <= 0)
    throw new Error("Stake must be a positive integer");
  if (
    !Number.isSafeInteger(priceBasisPoints) ||
    priceBasisPoints <= 0 ||
    priceBasisPoints > BASIS_POINTS
  )
    throw new Error("Invalid price basis points");
  const sharesMicros = Math.floor(
    (stakeCredits * BASIS_POINTS * MICROSHARES_PER_SHARE) / priceBasisPoints,
  );
  const potentialPayoutCredits = Math.floor(sharesMicros / MICROSHARES_PER_SHARE);
  return { sharesMicros, potentialPayoutCredits };
}
export function validateQuotePrices(prices: readonly number[]) {
  return (
    prices.length >= 2 &&
    prices.every((price) => Number.isSafeInteger(price) && price > 0) &&
    prices.reduce((sum, price) => sum + price, 0) === BASIS_POINTS
  );
}
export function resolveMarket(input: ResolutionInput): ResolutionOutput {
  if (!input.finalised) throw new Error("Explicit game_finalised observation is required");
  if (
    ![input.participant1Goals, input.participant2Goals].every(
      (score) => Number.isSafeInteger(score) && score >= 0,
    )
  )
    throw new Error("Final scores are required");
  if (input.ruleVersion === "match-result@1") {
    const home = input.participant1IsHome ? input.participant1Goals : input.participant2Goals;
    const away = input.participant1IsHome ? input.participant2Goals : input.participant1Goals;
    return {
      ruleVersion: input.ruleVersion,
      winningOutcomeKey: home === away ? "DRAW" : home > away ? "HOME" : "AWAY",
    };
  }
  if (input.ruleVersion === "total-goals-2.5@1")
    return {
      ruleVersion: input.ruleVersion,
      winningOutcomeKey: input.participant1Goals + input.participant2Goals >= 3 ? "OVER" : "UNDER",
    };
  if (input.ruleVersion === "both-teams-to-score@1")
    return {
      ruleVersion: input.ruleVersion,
      winningOutcomeKey: input.participant1Goals > 0 && input.participant2Goals > 0 ? "YES" : "NO",
    };
  throw new Error("Unsupported market rule version");
}
export function canonicalReceiptFields(
  fields: Readonly<Record<string, string | number | boolean | null>>,
) {
  return Object.keys(fields)
    .sort()
    .map((key) => `${JSON.stringify(key)}:${JSON.stringify(fields[key])}`)
    .join("|");
}
