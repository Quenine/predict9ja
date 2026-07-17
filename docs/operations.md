# Operations

This guide covers local development, testing, deployment and operator workflows for Predict9ja.

## Prerequisites

- Node.js 22
- pnpm 10.12.1
- Docker
- PostgreSQL 16 through the included Compose configuration

Confirm the runtime before installing dependencies:

```bash
node --version
pnpm --version
```

## Local setup

```bash
corepack enable
pnpm install --frozen-lockfile
cp .env.example .env
pnpm db:up
pnpm db:deploy
pnpm db:seed
pnpm dev
```

`pnpm dev` loads the repository-root environment and starts the web application. Use `pnpm dev:all` only when both the web and worker development processes are required.

## Environment categories

Predict9ja expects these variable groups:

### Database

- `DATABASE_URL` — local and administrative PostgreSQL connection
- `PRISMA_ACCELERATE_URL` — serverless Prisma runtime transport
- `DATABASE_TEST_URL` — isolated integration-test database
- `POSTGRES_PORT` — local Compose port

### Session security

- `DEMO_SESSION_SECRET` — private secret used to hash anonymous session tokens

### TxLINE

- `TXLINE_NETWORK`
- `TXLINE_API_TOKEN`
- `TXLINE_REQUEST_TIMEOUT_MS`

### Solana validation

- `SOLANA_RPC_URL`
- `SOLANA_COMMITMENT`
- `SOLANA_VALIDATION_TIMEOUT_MS`

### Optional guarded diagnostics

- `TXLINE_VALIDATION_WALLET_PATH`
- `TXLINE_VALIDATION_DIAGNOSTIC`

Never commit environment files, provider credentials, database URLs or local diagnostic material.

## Database lifecycle

Start PostgreSQL:

```bash
pnpm db:up
```

Inspect logs:

```bash
pnpm db:logs
```

Apply committed migrations:

```bash
pnpm db:deploy
```

Seed deterministic local data:

```bash
pnpm db:seed
```

Stop without deleting data:

```bash
pnpm db:down
```

Resetting destroys the named local volume before recreating and seeding it:

```bash
pnpm db:reset
```

Do not run reset commands against shared or production databases.

## Test database isolation

Integration tests use `DATABASE_TEST_URL`. The preparation command requires a database name that clearly contains `test` and refuses the normal development database.

```bash
pnpm db:test:prepare
pnpm test:integration
```

Normal `pnpm test` runs both unit and integration suites.

## Quality gates

Run the complete local verification sequence:

```bash
pnpm format:check
pnpm lint
pnpm typecheck
pnpm test
pnpm build
pnpm check:web-runtime
```

The runtime smoke check prepares an isolated database, builds the production web application and probes principal routes including the homepage, matches catalogue, fixture detail, replay experience, portfolio, partners and diagnostics.

## TxLINE fixture operations

Probe the configured provider safely:

```bash
pnpm txline:probe
```

Synchronize fixtures:

```bash
pnpm txline:sync-fixtures
```

Probe a fixture score endpoint:

```bash
pnpm txline:probe-scores --fixture-id <id>
```

Import ordered historical observations:

```bash
pnpm txline:import-history --fixture-id <id>
```

Run the SSE consumer for an operator-controlled interval:

```bash
pnpm txline:stream-scores --duration 60
```

Provider commands require a valid TxLINE server-side credential and never fall back silently to synthetic data.

## Market operations

Generate demonstration markets:

```bash
pnpm markets:generate-all
```

Preview resolution without writing:

```bash
pnpm markets:resolve --fixture-id <id> --dry-run
```

Resolve and settle through the supported operator workflow:

```bash
pnpm markets:resolve --fixture-id <id>
pnpm markets:settle --fixture-id <id>
```

Use the browser replay for the public interactive demonstration. Operator commands are intended for controlled maintenance and verification.

## Proof operations

Fetch proof material for an exact observation:

```bash
pnpm txline:fetch-proof --fixture-id <id> --sequence <seq> --stat-keys 1,2
```

Verify stored proof material:

```bash
pnpm txline:verify-proof --fixture-id <id> --sequence <seq> --stat-keys 1,2
```

Retry an eligible verification:

```bash
pnpm txline:retry-verification --fixture-id <id> --sequence <seq>
```

The normal validation path is read-only. Guarded diagnostics should use disposable local-only devnet material and must never expose secret bytes or file contents in logs, support bundles or source control.

## Featured verified evidence

The production replay is anchored to:

- fixture `18241006`;
- England 1–2 Argentina;
- authoritative provider sequence `962`;
- action `game_finalised`;
- exact stat keys `1,2`;
- read-only verified source evidence.

Sequence `963` is retained as a later non-final observation and is not used as final authority.

## Vercel deployment

The web runtime is deployed on Vercel and uses Prisma Accelerate. Administrative migrations and seeds continue to use `DATABASE_URL` from a secure operator environment.

The build sequence must generate the Prisma client without a local query engine before building the monorepo:

```bash
pnpm install --frozen-lockfile
pnpm --filter @predict9ja/db exec prisma generate --no-engine
pnpm build
```

Environment changes apply only to subsequent deployments. Redeploy after changing production configuration.

## GitHub Actions fixture synchronization

The `TxLINE fixture catalogue sync` workflow runs every 30 minutes and supports manual dispatch. It requires repository secrets for the production Prisma transport and TxLINE credential.

The workflow performs only fixture synchronization. It does not run migrations, seeds, resets, settlement or proof diagnostics. Concurrency controls prevent overlapping catalogue syncs.

## Production health checks

The public health endpoint is:

```text
https://predict9ja-web.vercel.app/api/health
```

A healthy response should report:

- application status `ok`;
- database connected;
- migrations compatible;
- verified evidence available;
- synthetic fixture available.

After a provider or database incident, require repeated healthy responses before treating the service as recovered. Then exercise the main replay flow and confirm health again.

## Incident handling

When the health endpoint reports a degraded database state:

1. Check the status of Vercel, Prisma Accelerate and the underlying database provider.
2. Confirm expected environment-variable names without exposing their values.
3. Review deployment logs for bounded error codes.
4. Avoid rotating credentials or changing transports until the failure category is known.
5. Redeploy only when configuration changed or the runtime must be refreshed.
6. Verify the health endpoint repeatedly after recovery.

Provider-wide incidents should not trigger unnecessary application changes.

## Release checklist

Before a release or public demonstration:

1. Run all quality gates.
2. Confirm the production health endpoint is stable.
3. Open the fixture catalogue and featured replay in a fresh browser session.
4. Place and settle a demo prediction.
5. Open the application receipt and verified source evidence.
6. Confirm that fictional settlement and source verification remain clearly separated.
7. Confirm that no credentials, local files or diagnostic output are present in the repository.
