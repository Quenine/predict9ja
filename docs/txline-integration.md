# TxLINE integration

Predict9ja uses TxLINE as its external authority for football fixtures, score observations and score-stat proof material. The integration is deliberately separated from prediction rules and settlement accounting.

## Authentication lifecycle

The server exchanges the configured TxLINE API token for a guest JWT through `POST /auth/guest/start`. The JWT is retained in memory only and is never written to the database or browser.

The client deduplicates concurrent authentication requests, refreshes once after an authentication rejection and never retries indefinitely. All provider requests use a finite timeout with an upper bound.

## Endpoints

| Endpoint | Purpose | Use in Predict9ja |
| --- | --- | --- |
| `POST /auth/guest/start` | Obtain a guest JWT | Used before authenticated TxLINE operations |
| `GET /api/fixtures/snapshot` | Retrieve the fixture catalogue | Transactional catalogue synchronization |
| `GET /api/scores/snapshot/{fixtureId}` | Retrieve a controlled score snapshot | Operator ingestion and diagnostics |
| `GET /api/scores/historical/{fixtureId}` | Retrieve historical score observations | Ordered import for the verified replay |
| `GET /api/scores/stream` | Consume score events through SSE | Checkpointed worker ingestion |
| `GET /api/scores/stat-validation` | Retrieve score-stat proof material | Exact observation verification |

Provider credentials remain server-side. TxLINE odds are not consumed; Predict9ja generates fixed application quotes for demonstration purposes.

## Fixture normalization

Fixture synchronization accepts provider field aliases and converts them into one application schema. The normalizer preserves:

- provider fixture identity;
- scheduled kickoff time;
- participant identities and names;
- participant ordering;
- displayed home and away orientation;
- normalized schedule state;
- source network and synchronization metadata.

Partial invalid records are rejected without discarding valid records from the same response. Synchronization upserts fixtures and advances its checkpoint transactionally.

Catalogue coverage is limited to fixtures exposed by the configured TxLINE devnet subscription and snapshot. Predict9ja does not claim complete tournament coverage when the provider response does not contain it.

## Score normalization

The score boundary accepts common provider aliases such as `FixtureId`/`fixtureId`, `Seq`/`seq`, `Ts`/`ts`, `StatusId`/`statusId`, `Period`/`period`, `Action`/`action` and `Stats`/`stats`.

For football observations:

- stat key `1` is Participant 1 total goals;
- stat key `2` is Participant 2 total goals.

Participant ordering remains independent of the displayed home and away orientation.

Observations are unique by fixture and provider sequence. Identical duplicates are harmless. Conflicting duplicates are treated as integrity errors. Older observations may be retained for provenance but cannot regress the canonical projection.

## Snapshot, history and SSE behavior

Score snapshots provide controlled current-state ingestion. Historical responses provide ordered observations for a bounded provider availability window. Empty or unavailable history is treated as a known operational outcome rather than malformed success.

The SSE worker stores operational checkpoint data such as the last acknowledged event ID, processed sequence and timestamp, connection state and a bounded safe error category. `Last-Event-ID` advances only after successful database processing.

SSE support is implemented but is not continuously hosted on Vercel. The public historical replay reads stored observations and presents them over a short bounded interval; it is not a currently live stream.

## Finalisation semantics

Schedule status, match phase and explicit finalisation are separate concepts.

Provider phases are normalized when recognized. Unrecognized values remain `UNKNOWN` rather than being guessed. A finished-looking phase does not by itself authorize settlement.

Only a normalized `game_finalised` action sets `finalised=true`. Market resolution requires that explicit final observation and complete participant scores.

For England versus Argentina, fixture `18241006`:

- sequence `962` is the authoritative final observation;
- score is 1–2;
- action is `game_finalised`;
- `finalised=true`;
- sequence `963` arrived later but is non-final and cannot replace sequence `962` as authority.

## Proof retrieval

Predict9ja requests proof material by exact fixture ID, provider sequence and ordered stat-key list. The response is strictly normalized and bounded before persistence.

Ordered stat keys form part of proof identity. Proof arrays, provider credentials, guest JWTs and unrestricted raw payloads are not emitted in application logs.

The canonical digest for fixture `18241006`, sequence `962`, stat keys `1,2` is:

```text
0abc3af2ebb38623b3d2e89ebb4e19071e4b867be814c7107d0fa7d8921808a7
```

## Solana validation

Validation targets TxLINE's Solana devnet program:

```text
Program: 6pW64gN1s2uqjHkn1unFeEjAwJkPGHoppGvS715wyP2J
Daily Scores PDA: HJ6nSVkUs4VG9JQ5sEUq3VbmyUSBf76ePXUCATLtRYTX
```

The verifier pins the network, RPC genesis, program address, vendored IDL, account derivation and requested predicates. It uses the read-only validation path and does not submit a transaction.

For the featured final observation, the exact Participant 1 and Participant 2 score predicates validate successfully. The evidence classification is final match data verified without a linked real-market settlement receipt.

## Error handling

The integration exposes bounded typed failure categories for:

- missing or invalid configuration;
- authentication rejection;
- request timeout;
- rate limiting;
- unavailable history;
- malformed provider records;
- unsupported or unknown provider state;
- proof normalization failure;
- RPC or validation preflight failure.

Errors are summarized without logging API tokens, JWTs or unrestricted provider payloads.

## Integration observations

The normalized fixture and score schemas work well for deterministic persistence and replay. Explicit participant orientation and proof identity make downstream verification practical.

The integration also requires careful handling of provider-state ambiguity. Historical availability can legitimately return no data, phases may remain `UNKNOWN`, and a later non-final observation can follow an explicit final observation. Predict9ja therefore treats explicit finalisation and sequence-aware authority as first-class rules rather than inferring truth from the newest record alone.

## Current limitations

- Fixture breadth follows the configured TxLINE devnet snapshot and subscription.
- Historical replay depends on observations imported during the provider's availability window.
- SSE ingestion requires a continuously running worker and is not hosted as such on Vercel.
- TxLINE odds and price discovery are not integrated.
- Source proof verification does not automatically settle real-value markets.
