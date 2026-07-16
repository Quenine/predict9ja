# Architecture

Next.js presents the arena, Judge Mode, portfolio, and receipts. Worker commands own TxLINE ingestion, proof retrieval, verification, replay, and markets. PostgreSQL is authoritative.

packages/txline handles guest JWTs, HTTP/SSE, bounded timeout/retry, and strict normalization. packages/verification owns digests, IDL-pinned validation, and read-only Solana execution. packages/db persists observations, bounded proof envelopes, classifications, sessions, ledger, and receipts. packages/domain contains pure market rules.

Raw payloads are not archived. Credentials and diagnostic wallet data remain outside persistence and logs. Judge Mode selects one verified final proof and its related live game_finalised observation, never independently selected sequences. Real evidence is separate from synthetic settlement.
