# Development

Node.js 22 is mandatory: run `node --version` and confirm `v22.x`. Install Docker and pnpm 10. Copy `.env.example` to `.env`; credentials are local examples only.

The safe local PostgreSQL port is `55432`; change `POSTGRES_PORT` and the matching `DATABASE_URL` together when needed. `pnpm verify:foundation` checks Node 22, connectivity, the initial migration, and exact synthetic seed counts.

Start PostgreSQL 16 with `pnpm db:up`, inspect it with `pnpm db:logs`, apply committed migrations with `pnpm db:deploy`, and run `pnpm db:seed` twice safely. `pnpm db:reset` destroys the local named volume before recreating and seeding it. Stop without deleting data with `pnpm db:down`.

Synthetic data uses `pnpm db:seed-synthetic`. Real fixture commands are `pnpm txline:probe` and `pnpm txline:sync-fixtures`; both require `TXLINE_API_TOKEN` and never fall back. Run quality gates with `pnpm format:check`, `pnpm lint`, `pnpm typecheck`, `pnpm test`, and `pnpm build`.
