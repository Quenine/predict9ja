# Deployment runbook

## Runtime and preparation

Use Node 22, pnpm 10.12.1, PostgreSQL 16, and separate web/worker processes. Inject DATABASE_URL, DEMO_SESSION_SECRET, TXLINE_NETWORK, TXLINE_API_TOKEN, TXLINE_REQUEST_TIMEOUT_MS, SOLANA_RPC_URL, SOLANA_COMMITMENT, and SOLANA_VALIDATION_TIMEOUT_MS through a secret manager.

Run pnpm install --frozen-lockfile, pnpm db:generate, pnpm db:deploy, pnpm db:seed once, and pnpm build. Use the platform start command for the built Next.js application. Never embed credentials in scripts.

## Populate judge evidence

From a secure local operator shell connected to the remote database, run pnpm txline:sync-fixtures, pnpm txline:ingest-score-snapshot --fixture-id 18241006, then pnpm txline:verify-proof --fixture-id 18241006 --sequence 962 --stat-keys 1,2.

If guarded diagnostics are required, use a disposable funded devnet wallet outside the repository. Never upload it to the host or commit its path or secret material.

## Verify

Open /judge and confirm fixture 18241006, sequence 962, score 1–2, game_finalised, the documented digest/program/PDA, read-only VERIFIED, final-match wording, and the no-receipt note. Confirm the synthetic demo-credit section is visibly separate.
