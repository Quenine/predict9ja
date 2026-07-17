export type PositionPresentation = Readonly<{
  settledAt: Date | null;
  actualPayoutCredits: number | null;
  market: Readonly<{ receipt: Readonly<{ settlementStatus: string }> | null }>;
}>;
export function positionStatus(position: PositionPresentation) {
  if (!position.settledAt) return "open" as const;
  if (position.market.receipt?.settlementStatus === "VOID") return "void" as const;
  return (position.actualPayoutCredits ?? 0) > 0 ? ("won" as const) : ("lost" as const);
}
