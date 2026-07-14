export type FixtureStatus = "SCHEDULED" | "LIVE" | "FINISHED" | "CANCELLED" | "UNKNOWN";
export type MarketStatus = "DRAFT" | "OPEN" | "SUSPENDED" | "CLOSED" | "RESOLVED" | "VOID";
export type MarketType = "MATCH_RESULT" | "TOTAL_GOALS_2_5" | "BOTH_TEAMS_TO_SCORE";
export type SourceMode = "LIVE" | "REPLAY" | "SYNTHETIC";
export const SOCCER_PHASES = {
  1: "NOT_STARTED",
  2: "FIRST_HALF",
  3: "HALFTIME",
  4: "SECOND_HALF",
  5: "FINISHED",
  6: "WAITING_FOR_EXTRA_TIME",
  7: "EXTRA_TIME_FIRST_HALF",
  8: "EXTRA_TIME_HALFTIME",
  9: "EXTRA_TIME_SECOND_HALF",
  10: "FINISHED_AFTER_EXTRA_TIME",
  11: "WAITING_FOR_PENALTIES",
  12: "PENALTIES_IN_PROGRESS",
  13: "FINISHED_AFTER_PENALTIES",
  14: "INTERRUPTED",
  15: "ABANDONED",
  16: "CANCELLED",
  17: "COVERAGE_CANCELLED",
  18: "COVERAGE_SUSPENDED",
  19: "POSTPONED",
} as const;
export type SoccerPhase = (typeof SOCCER_PHASES)[keyof typeof SOCCER_PHASES] | "UNKNOWN";
export type ScoreAction = "score_update" | "phase_update" | "game_finalised" | "unknown";

export function soccerPhaseOf(value: unknown): SoccerPhase {
  if (typeof value !== "number" && typeof value !== "string") return "UNKNOWN";
  const id = Number(value);
  return Number.isInteger(id) && id in SOCCER_PHASES
    ? SOCCER_PHASES[id as keyof typeof SOCCER_PHASES]
    : "UNKNOWN";
}

export type ParticipantFixture = Readonly<{
  participant1Name: string;
  participant2Name: string;
  participant1IsHome: boolean;
}>;
export function displayedTeams(fixture: ParticipantFixture) {
  return fixture.participant1IsHome
    ? { homeTeam: fixture.participant1Name, awayTeam: fixture.participant2Name }
    : { homeTeam: fixture.participant2Name, awayTeam: fixture.participant1Name };
}
export function displayedScore(
  participant1IsHome: boolean,
  participant1Goals: number | null,
  participant2Goals: number | null,
) {
  return participant1IsHome
    ? { homeScore: participant1Goals, awayScore: participant2Goals }
    : { homeScore: participant2Goals, awayScore: participant1Goals };
}
export type ProofStatus = "PENDING" | "VERIFIED" | "FAILED";
export type SettlementStatus = "PENDING" | "SETTLED" | "VOID";

export type MarketOutcome = Readonly<{ key: string; label: string }>;
export type MarketTemplate = Readonly<{
  type: MarketType;
  title: string;
  ruleVersion: RuleVersion;
  outcomes: readonly MarketOutcome[];
}>;

export const RULE_VERSIONS = {
  MATCH_RESULT: "match-result@1",
  TOTAL_GOALS_2_5: "total-goals-2.5@1",
  BOTH_TEAMS_TO_SCORE: "both-teams-to-score@1",
} as const;
export type RuleVersion = (typeof RULE_VERSIONS)[keyof typeof RULE_VERSIONS];

const transitions: Readonly<Record<MarketStatus, readonly MarketStatus[]>> = {
  DRAFT: ["OPEN", "VOID"],
  OPEN: ["SUSPENDED", "CLOSED", "VOID"],
  SUSPENDED: ["OPEN", "CLOSED", "VOID"],
  CLOSED: ["RESOLVED", "VOID"],
  RESOLVED: [],
  VOID: [],
};

export function canTransitionMarket(from: MarketStatus, to: MarketStatus): boolean {
  return transitions[from].includes(to);
}

export function assertMarketTransition(from: MarketStatus, to: MarketStatus): void {
  if (!canTransitionMarket(from, to))
    throw new Error(`Invalid market transition: ${from} -> ${to}`);
}

export function createMarketTemplates(
  homeTeam: string,
  awayTeam: string,
): readonly MarketTemplate[] {
  if (!homeTeam.trim() || !awayTeam.trim()) throw new Error("Both team names are required");
  return [
    {
      type: "MATCH_RESULT",
      title: `${homeTeam} vs ${awayTeam}: match result`,
      ruleVersion: RULE_VERSIONS.MATCH_RESULT,
      outcomes: [
        { key: "HOME", label: homeTeam },
        { key: "DRAW", label: "Draw" },
        { key: "AWAY", label: awayTeam },
      ],
    },
    {
      type: "TOTAL_GOALS_2_5",
      title: "Total goals: 2.5",
      ruleVersion: RULE_VERSIONS.TOTAL_GOALS_2_5,
      outcomes: [
        { key: "OVER_2_5", label: "Over 2.5" },
        { key: "UNDER_2_5", label: "Under 2.5" },
      ],
    },
    {
      type: "BOTH_TEAMS_TO_SCORE",
      title: "Both teams to score",
      ruleVersion: RULE_VERSIONS.BOTH_TEAMS_TO_SCORE,
      outcomes: [
        { key: "YES", label: "Yes" },
        { key: "NO", label: "No" },
      ],
    },
  ];
}

const outcomeKeys: Readonly<Record<MarketType, readonly string[]>> = {
  MATCH_RESULT: ["HOME", "DRAW", "AWAY"],
  TOTAL_GOALS_2_5: ["OVER_2_5", "UNDER_2_5"],
  BOTH_TEAMS_TO_SCORE: ["YES", "NO"],
};

export function isValidOutcomeKey(type: MarketType, key: string): boolean {
  return outcomeKeys[type].includes(key);
}
