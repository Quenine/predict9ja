# Predict9ja World Cup Arena

A mobile-first football arena prototype with a Next.js web app, worker, pure domain package, PostgreSQL/Prisma storage, and normalized TxLINE fixture and score boundaries. Score snapshots, history, SSE ingestion, projections, and replay are implemented; trading, odds, settlement, proofs, wallets, and payments are not.

## Local setup

Use Node.js 22 (`node --version` must report `v22.x`; the engine rejects Node 24), pnpm 10 and Docker. Copy `.env.example` to `.env`, then run:

```sh
pnpm install --frozen-lockfile
pnpm db:up
pnpm db:deploy
pnpm db:seed
pnpm dev
```

Port `55432` is the safe local default and remains configurable with `POSTGRES_PORT`. The seed is idempotent and fictional. See `docs/DEVELOPMENT.md`, `docs/SCORE_PIPELINE.md`, and `docs/REPLAY_MODE.md`.
