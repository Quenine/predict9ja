# TxLINE API feedback

Predict9ja uses TxLINE for fixture discovery, score ingestion, historical replay and score-stat proof retrieval. The integration experience was strongest where TxLINE exposed normalized identifiers and verifiable evidence, and most demanding where provider state required explicit interpretation.

## What worked well

### Consistent fixture and score boundaries

The fixture snapshot and score endpoints provide stable identities that can be normalized into deterministic application records. Preserving fixture IDs, participant ordering, provider sequences and timestamps made it possible to build idempotent ingestion and a replay that can be audited observation by observation.

### Explicit participant orientation

TxLINE exposes enough participant information to preserve Participant 1 and Participant 2 independently from the displayed home and away order. This is important for preventing score inversion when provider ordering and presentation ordering differ.

### Historical observations

The historical score endpoint enabled a faithful replay from stored observations rather than a synthetic reconstruction. This was particularly valuable for demonstrating how a prediction moves from a user pick to a final result and receipt.

### Verifiable score-stat evidence

The stat-validation endpoint identifies proof material by fixture, sequence and ordered stat keys. That exact identity made it possible to normalize a bounded proof envelope, derive a canonical digest and validate the final score predicates against TxLINE's Solana devnet program through a read-only path.

### Practical authentication model

Exchanging a server-side API token for an in-memory guest JWT kept provider credentials away from the browser. The model was straightforward to wrap with request deduplication, bounded timeouts and one controlled refresh after authentication rejection.

## Where we encountered friction

### Historical availability

Historical responses can legitimately be empty or unavailable depending on the provider window. The integration needed explicit handling for HTTP 204, empty responses and unavailable history so these cases were not confused with malformed data or authentication failures.

### Ambiguous provider phases

Some observations retained an `UNKNOWN` phase even when other fields indicated meaningful match progress. Predict9ja therefore avoids guessing a phase and relies on explicit finalisation data for settlement authority.

### Final observations followed by later non-final data

For fixture `18241006`, sequence `962` is the explicit `game_finalised` observation, while sequence `963` arrived later with the same score but was non-final. Treating the newest sequence as automatically authoritative would have been incorrect. The application had to model finality separately from recency.

### Validation diagnostics

Read-only Solana validation is deterministic once the proof material, IDL, program and daily-scores account are aligned, but some diagnostic paths may still require a disposable funded devnet wallet for simulation preflight. The distinction between normal validation and guarded diagnostics must be documented carefully.

### Serverless background processing

The SSE endpoint is suitable for a continuously running worker, but Vercel does not provide that worker lifecycle for this deployment. Predict9ja implements checkpointed SSE ingestion as operator-run worker functionality and uses scheduled fixture synchronization for the hosted catalogue.

## Suggestions for TxLINE

- Document historical availability windows and empty-response semantics more explicitly.
- Publish a concise state model that distinguishes schedule status, match phase and finalisation.
- Clarify how consumers should treat observations that arrive after `game_finalised`.
- Provide a compact reference implementation for stat-validation and Solana read-only verification.
- Surface subscription and fixture-coverage limits in a machine-readable response where possible.
- Include operational guidance for SSE reconnection, checkpointing and expected quiet periods.

## Overall assessment

TxLINE supplied the essential data and verification primitives required by Predict9ja: fixture identity, participant orientation, ordered score observations, historical access and proof material tied to Solana-verifiable roots. The integration was successful, but robust consumers need explicit authority rules, bounded retries and careful handling of legitimate provider ambiguity.
