# Predict9ja World Cup Arena

Predict9ja is a hackathon prototype combining real TxLINE football evidence with a separate, non-custodial demo-credit prediction market. Judges can inspect a real final score, its normalized TxLINE proof, and read-only verification against the official TxLINE Solana devnet program.

> Hackathon prototype — real TxLINE sports evidence; demo-credit markets and no real-value transactions.

## Problem and solution

Sports prediction products often ask users to trust opaque data and settlement. Predict9ja retains canonical observations, retrieves a bounded proof for an exact fixture/sequence/stat identity, computes a deterministic digest, and validates it through a read-only Solana call. A separate synthetic flow demonstrates anonymous demo-credit positions, deterministic resolution, ledger reconciliation, and application receipts.

## Why TxLINE

TxLINE supplies fixture and score snapshots, history/SSE, and stat-validation proofs connecting off-chain sports data to verifiable on-chain roots. Provider credentials stay server-side; raw provider responses are not archived or logged.

## Architecture and repository

- apps/web: Next.js Judge Mode, arena, portfolio, receipts, and administration.
- apps/worker: ingestion, proof retrieval, verification, replay, and market commands.
- packages/txline: authenticated transport, normalization, bounded retries, safe errors.
- packages/verification: proof schema, digest, IDL-pinned read-only Solana validation.
- packages/db: Prisma/PostgreSQL persistence, classification, markets, ledger, receipts.
- packages/domain: framework-independent market and settlement rules.

A bounded normalized proof envelope is persisted for deterministic retries, never the complete raw provider response. Normal validation may use an ephemeral provider; guarded CLI diagnostics may use a disposable funded devnet wallet. Secret bytes and wallet paths are never persisted or logged.

## Key judge flow

1. Open /judge and inspect **Real TxLINE data and Solana proof verification**.
2. Confirm the final observation, digest, program, PDA, and read-only validation.
3. Continue to **Synthetic demo-credit prediction and settlement**.
4. Open a fictional position, run the synthetic replay, and inspect its separate receipt.

The synthetic payout is not triggered by the real proof.

## Verified real evidence

| Field                | Evidence                                                         |
| -------------------- | ---------------------------------------------------------------- |
| Fixture / sequence   | 18241006 / 962                                                   |
| Action / score       | game_finalised / 1–2                                             |
| Keys / values        | 1, 2 / 1, 2                                                      |
| Proof digest         | 0abc3af2ebb38623b3d2e89ebb4e19071e4b867be814c7107d0fa7d8921808a7 |
| Network / validation | devnet / read-only VERIFIED                                      |
| Program              | 6pW64gN1s2uqjHkn1unFeEjAwJkPGHoppGvS715wyP2J                     |
| Daily-root PDA       | HJ6nSVkUs4VG9JQ5sEUq3VbmyUSBf76ePXUCATLtRYTX                     |
| Classification       | FINAL_MATCH_OBSERVATION                                          |
| Settlement evidence  | FINAL_DATA_VERIFIED_NO_RECEIPT                                   |

No matching real-market settlement receipt is linked.

## Technology and local setup

Node 22, pnpm workspaces, TypeScript, Next.js 15, PostgreSQL 16, Prisma, Zod, Vitest, Anchor/Solana web3, and Turbo.

1. Copy .env.example to .env and replace placeholders locally.
2. Run: pnpm install --frozen-lockfile; pnpm db:up; pnpm db:generate; pnpm db:deploy; pnpm db:seed; pnpm dev.
3. Verify with pnpm db:test:prepare, pnpm verify:foundation, pnpm format:check, pnpm lint, pnpm typecheck, pnpm test, and pnpm build.

See [docs/DEPLOYMENT.md](docs/DEPLOYMENT.md) for production setup.

## Limitations and security

No real-value transactions, custody, deposits, withdrawals, TxLINE odds, or automatic real-proof market settlement. Demo credits have no monetary value. Proof validation is read-only. Tokens, JWTs, database credentials, session secrets, and wallet material stay outside source control.

- Live demo: _add deployment URL_
- Demo video: _add video URL_
