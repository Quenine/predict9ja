# Predict9ja World Cup Arena

Batch 5 adds strict TxLINE score-stat proof retrieval, canonical proof digests, persistent verification attempts, and read-only Solana validation through the official TxLINE `validateStatV2` instruction. No transaction is sent and no money can be deposited or withdrawn.

A mobile-first football arena prototype with a Next.js web app, worker, pure domain package, PostgreSQL/Prisma storage, normalized TxLINE feeds, demo-credit settlement, and separately labelled application/proof/Solana evidence.

## Local setup

Use Node.js 22 (`node --version` must report `v22.x`; the engine rejects Node 24), pnpm 10 and Docker. Copy `.env.example` to `.env`, then run:

```sh
pnpm install --frozen-lockfile
pnpm db:up
pnpm db:deploy
pnpm db:seed
pnpm db:test:prepare
pnpm dev
```

Port `55432` is the safe local default and remains configurable with `POSTGRES_PORT`. The seed is idempotent and fictional. See `docs/TXLINE_PROOFS.md` and `docs/SOLANA_VALIDATION.md` for the read-only verification path.
