# Architecture

Batch 4 browser accounts are isolated anonymous sessions whose opaque cookie tokens are stored only as secret-bound hashes. An append-only ledger is authoritative for demo-credit reconciliation. Quote-versioned purchases, positions, lifecycle audits, resolution receipts, and settlement updates execute transactionally in `packages/db`; pure arithmetic and versioned rules remain in `packages/domain`.

The Next.js web application presents fixtures, markets, positions, and proof receipts. A separate long-running worker will own live or replay ingestion so feed continuity is independent of web requests. Both will use the focused data access exported by `packages/db`.

`packages/domain` contains framework-independent rules. `packages/txline` owns authenticated sports-feed and proof retrieval. `packages/verification` owns strict proof normalization, canonical proof digests, network configuration, and the read-only Anchor adapter; it has no Prisma or React imports. `packages/db` alone persists bounded verification attempts and optional receipt links.

PostgreSQL is the system of record. Prisma models demo users, normalized fixtures, versioned markets, outcomes, integer-credit trades and positions, receipts, and feed cursors.

Proof retrieval, local LIVE-observation matching, and Solana validation are separate states. An in-play verified observation cannot become final settlement evidence. Receipt linkage requires the same explicit `game_finalised` observation and provider sequence.

Fixture snapshots pass through transport/authentication, Zod validation and normalization in packages/txline, then transactional persistence and checkpointing in packages/db. Server components read PostgreSQL directly; credentials remain server-only.
