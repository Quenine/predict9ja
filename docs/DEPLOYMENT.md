# Deployment runbook

## Runtime and preparation

Use Node 22, pnpm 10.12.1, PostgreSQL 16, and separate web/worker processes. Local and administrative commands use `DATABASE_URL` with a normal PostgreSQL URL. The Vercel web runtime instead uses `PRISMA_ACCELERATE_URL`; inject it and all other credentials through the platform secret manager.

Run pnpm install --frozen-lockfile, pnpm db:generate, pnpm db:deploy, pnpm db:seed once, and pnpm build. Database migrations and seeds remain administrative operations using `DATABASE_URL`. Set the Vercel build command to `pnpm install --frozen-lockfile && pnpm --filter @predict9ja/db exec prisma generate --no-engine && pnpm build`. Use the platform start command for the built Next.js application. Never embed credentials in scripts.

For local development, pnpm dev loads the repository-root .env and starts only the web UI.
Use pnpm dev:all only when both web and the idle worker lifecycle are deliberately required.
Existing local .env files must include DEMO_SESSION_SECRET with at least 16 characters. Generate
one with node -e "console.log(require('node:crypto').randomBytes(32).toString('hex'))" and keep it
outside source control.

## Populate judge evidence

From a secure local operator shell connected to the remote database, run pnpm txline:sync-fixtures, pnpm txline:ingest-score-snapshot --fixture-id 18241006, then pnpm txline:verify-proof --fixture-id 18241006 --sequence 962 --stat-keys 1,2.

If guarded diagnostics are required, use a disposable funded devnet wallet outside the repository. Never upload it to the host or commit its path or secret material.

## Automated TxLINE fixture catalogue

The `TxLINE fixture catalogue sync` GitHub Actions workflow runs every 30 minutes and can also be started with `workflow_dispatch`. In repository Settings → Secrets and variables → Actions, add these repository secrets:

- `PRISMA_ACCELERATE_URL`: the production Prisma Accelerate URL beginning with `prisma://` or `prisma+postgres://`.
- `TXLINE_API_TOKEN`: the activated TxLINE API token.

The workflow supplies `TXLINE_NETWORK=devnet` and `TXLINE_REQUEST_TIMEOUT_MS=30000` as non-secret configuration. It generates Prisma Client with `--no-engine` and runs only `pnpm txline:sync-fixtures`. It does not run migrations, seeds, resets, proof verification, settlement, or diagnostic-wallet operations. Workflow concurrency prevents overlapping catalogue syncs.

## Verify

Open /judge and confirm fixture 18241006, sequence 962, score 1–2, game_finalised, the documented digest/program/PDA, read-only VERIFIED, final-match wording, and the no-receipt note. Confirm the synthetic demo-credit section is visibly separate.
