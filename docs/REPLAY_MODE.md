# Replay mode

The fictional seed contains pre-match, first-half score, halftime, second-half score, finished-phase, and explicit `game_finalised` observations. Replay reads those normalized observations in provider-sequence order and updates only `ReplayScoreState`.

```sh
pnpm txline:replay-scores --fixture-id synthetic-kora-savanna-001 --speed 100000
```

The speed multiplier scales provider-time gaps. SIGINT/SIGTERM cancels cleanly. Replay never calls TxLINE, never inserts duplicate observations, and never changes the canonical provider projection. Replay state is intentionally transient and separately labelled in the web application.
