export type HistoricalAvailability = "TOO_RECENT" | "TOO_OLD" | "ELIGIBLE" | "UNKNOWN";

const SIX_HOURS_MS = 6 * 60 * 60 * 1_000;
const TWO_WEEKS_MS = 14 * 24 * 60 * 60 * 1_000;

export function classifyHistoricalAvailability(
  startsAt: Date | null | undefined,
  now = new Date(),
): HistoricalAvailability {
  if (!startsAt || !Number.isFinite(startsAt.getTime())) return "UNKNOWN";
  const elapsed = now.getTime() - startsAt.getTime();
  if (elapsed < SIX_HOURS_MS) return "TOO_RECENT";
  if (elapsed > TWO_WEEKS_MS) return "TOO_OLD";
  return "ELIGIBLE";
}

export function historicalAvailabilityReason(availability: HistoricalAvailability): string {
  if (availability === "TOO_RECENT")
    return "TxLINE historical data is available six hours after fixture start";
  if (availability === "TOO_OLD")
    return "TxLINE historical data is available for two weeks after fixture start";
  if (availability === "UNKNOWN") return "Fixture start time is unavailable";
  return "TxLINE historical data is within the documented availability window";
}
