import {
  soccerPhaseOf,
  type ScoreAction,
  type SoccerPhase,
  type SourceMode,
} from "@predict9ja/domain";

export type NormalizedScore = Readonly<{
  fixtureSourceId: string;
  sequence: number;
  providerTimestamp: Date;
  action: ScoreAction;
  phase: SoccerPhase;
  period: string | null;
  participant1Goals: number | null;
  participant2Goals: number | null;
  finalised: boolean;
  sourceMode: SourceMode;
  sseEventId?: string;
}>;
export type ScoreBatch = Readonly<{
  scores: readonly NormalizedScore[];
  fetched: number;
  rejected: number;
  rejectionReasons: Readonly<Record<string, number>>;
}>;

const objectOf = (value: unknown): Record<string, unknown> | null =>
  typeof value === "object" && value !== null && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
const alias = (record: Record<string, unknown>, upper: string, lower: string) =>
  record[upper] ?? record[lower];
function reason(error: unknown) {
  return error instanceof Error ? error.message : "malformed_record";
}
function scoreOf(stats: unknown, key: "1" | "2"): number | null {
  if (stats === undefined || stats === null) return null;
  const object = objectOf(stats);
  if (!object) throw new Error("malformed_stats");
  const raw = object[key];
  if (raw === undefined || raw === null) return null;
  const nested = objectOf(raw);
  const value = nested ? (nested.Value ?? nested.value ?? nested.Total ?? nested.total) : raw;
  const number =
    typeof value === "number"
      ? value
      : typeof value === "string" && value.trim()
        ? Number(value)
        : NaN;
  if (!Number.isInteger(number) || number < 0)
    throw new Error(number < 0 ? "negative_score" : "malformed_stats");
  return number;
}
export function normalizeScoreRecord(
  input: unknown,
  sourceMode: SourceMode = "LIVE",
  sseEventId?: string,
): NormalizedScore {
  const record = objectOf(input);
  if (!record) throw new Error("malformed_record");
  const fixture = alias(record, "FixtureId", "fixtureId");
  if ((typeof fixture !== "string" && typeof fixture !== "number") || String(fixture).length === 0)
    throw new Error("invalid_fixture_id");
  const sequence = Number(alias(record, "Seq", "seq"));
  if (!Number.isInteger(sequence) || sequence < 1) throw new Error("invalid_sequence");
  const timestamp = alias(record, "Ts", "ts");
  const date = new Date(
    typeof timestamp === "string" || typeof timestamp === "number" ? timestamp : NaN,
  );
  if (Number.isNaN(date.getTime())) throw new Error("invalid_timestamp");
  const actionValue = alias(record, "Action", "action");
  const rawAction = (typeof actionValue === "string" ? actionValue : "unknown").toLowerCase();
  const action: ScoreAction =
    rawAction === "game_finalised" || rawAction === "score_update" || rawAction === "phase_update"
      ? rawAction
      : "unknown";
  const stats = alias(record, "Stats", "stats");
  return {
    fixtureSourceId: String(fixture),
    sequence,
    providerTimestamp: date,
    action,
    phase: soccerPhaseOf(alias(record, "StatusId", "statusId")),
    period: (() => {
      const value = alias(record, "Period", "period");
      return typeof value === "string" || typeof value === "number" ? String(value) : null;
    })(),
    participant1Goals: scoreOf(stats, "1"),
    participant2Goals: scoreOf(stats, "2"),
    finalised: action === "game_finalised",
    sourceMode,
    ...(sseEventId === undefined ? {} : { sseEventId }),
  };
}
function records(payload: unknown): unknown[] {
  if (Array.isArray(payload)) return payload;
  const object = objectOf(payload);
  const value = object?.scores ?? object?.Scores ?? object?.data;
  if (!Array.isArray(value)) throw new Error("invalid_score_envelope");
  return value;
}
export function normalizeScoreBatch(payload: unknown, sourceMode: SourceMode = "LIVE"): ScoreBatch {
  const input = records(payload);
  const scores: NormalizedScore[] = [];
  const rejectionReasons: Record<string, number> = {};
  for (const record of input) {
    try {
      scores.push(normalizeScoreRecord(record, sourceMode));
    } catch (error) {
      const key = reason(error);
      rejectionReasons[key] = (rejectionReasons[key] ?? 0) + 1;
    }
  }
  return {
    scores,
    fetched: input.length,
    rejected: input.length - scores.length,
    rejectionReasons,
  };
}
