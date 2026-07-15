# Market rules

Eligible fixtures receive exactly three idempotent, ordered templates: match result (`HOME`, `DRAW`, `AWAY`), total goals 2.5 (`OVER`, `UNDER`), and both teams to score (`YES`, `NO`). Rule identifiers are `match-result@1`, `total-goals-2.5@1`, and `both-teams-to-score@1`. Cancelled fixtures are skipped.

The lifecycle is `DRAFT → ACTIVE → CLOSED → RESOLUTION_READY → RESOLVED`, with explicit `VOID` branches. Terminal states cannot reopen. Every transition has a bounded audit row. `RESOLUTION_READY` requires an explicit normalized `game_finalised` observation with both participant scores. A normal finished phase is insufficient.

Match result maps Participant 1/2 scores to displayed home/away using `participant1IsHome`. Total goals is `OVER` at three or more and `UNDER` otherwise. Both teams to score is `YES` only when both participant totals are at least one. Unknown rules and incomplete scores are rejected.
