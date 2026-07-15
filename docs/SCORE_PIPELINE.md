# Score pipeline

Batch 3 adds normalized TxLINE scores without market resolution. TxLINE exposes `GET /api/scores/snapshot/{fixtureId}`, `GET /api/scores/historical/{fixtureId}`, and `GET /api/scores/stream`. Live commands require `TXLINE_API_TOKEN`; there is no synthetic fallback.

Provider `FixtureId`/`fixtureId`, `Seq`/`seq`, `Ts`/`ts`, `StatusId`/`statusId`, `Period`/`period`, `Action`/`action`, and `Stats`/`stats` aliases are accepted. Stat key `1` is Participant 1 total goals and key `2` is Participant 2 total goals. Participant order is retained independently of displayed home/away order.

Fixture schedule status and soccer match phase are separate. Phases 1–19 map to not started, first half, halftime, second half, finished, waiting for extra time, extra-time first half, extra-time halftime, extra-time second half, finished after extra time, waiting for penalties, penalties in progress, finished after penalties, interrupted, abandoned, cancelled, coverage cancelled, coverage suspended, and postponed. Unrecognized values remain `UNKNOWN`.

A finished phase is not finalisation. Only normalized `game_finalised` sets `finalised=true`; Batch 3 does not settle markets. Observations are unique by fixture and provider sequence. Newer observations advance the canonical projection, older observations cannot regress it, identical duplicates are harmless, and conflicting duplicates are integrity errors.

The live checkpoint stores only operational state: last acknowledged event ID, last processed sequence/time, connection-opened and last-message times, connection status, and a safe error category. `Last-Event-ID` advances only after database processing succeeds. Raw provider payloads and credentials are never stored or logged.

Commands:

```sh
pnpm txline:probe-scores --fixture-id ID
pnpm txline:import-history --fixture-id ID
pnpm txline:stream-scores
pnpm txline:stream-scores --duration 60
```

`txline:import-history` exits with code 2 when history is unavailable (too recent, too old,
empty, or HTTP 204) and code 3 for malformed provider JSON. Both cases print only a safe JSON
summary; authentication and other HTTP failures retain their typed error behavior.

Current limitations: provider coverage depends on the configured subscription; an open stream can legitimately receive zero score messages. Odds, trading, balances, market resolution, settlement, proofs, Solana, and production authentication are out of scope.
