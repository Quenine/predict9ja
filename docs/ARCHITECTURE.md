# Architecture

Batch 4 browser accounts are isolated anonymous sessions whose opaque cookie tokens are stored only as secret-bound hashes. An append-only ledger is authoritative for demo-credit reconciliation. Quote-versioned purchases, positions, lifecycle audits, resolution receipts, and settlement updates execute transactionally in `packages/db`; pure arithmetic and versioned rules remain in `packages/domain`.

The Next.js web application presents fixtures, markets, positions, and proof receipts. A separate long-running worker will own live or replay ingestion so feed continuity is independent of web requests. Both will use the focused data access exported by `packages/db`.

`packages/domain` contains framework-independent types, market templates, and transition rules. `packages/txline` defines the narrow sports-feed boundary and a local synthetic adapter. Normalized records cross this boundary; provider payloads do not. `packages/config` holds strict shared tooling defaults.

PostgreSQL is the system of record. Prisma models demo users, normalized fixtures, versioned markets, outcomes, integer-credit trades and positions, receipts, and feed cursors.

Fixture snapshots pass through transport/authentication, Zod validation and normalization in packages/txline, then transactional persistence and checkpointing in packages/db. Server components read PostgreSQL directly; credentials remain server-only.
