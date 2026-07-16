# TxLINE integration

TxLINE request timeouts produce safe JSON with error category
TXLINE_REQUEST_TIMEOUT, a bounded endpoint category, and exit code 2.
Guest authentication retries once after a short bounded delay; it never retries indefinitely.

Batch 3 extends fixture synchronization with normalized score snapshots, history, checkpointed SSE ingestion, current projections, and replay. Participant order is retained independently from displayed home/away order. Only `game_finalised` is explicit finalisation; a finished phase alone is not.

Batch 2 supports fixture snapshots on `devnet` (`https://txline-dev.txodds.com`) and `mainnet` (`https://txline.txodds.com`). Set `TXLINE_NETWORK`, activated `TXLINE_API_TOKEN`, and optionally `TXLINE_REQUEST_TIMEOUT_MS`. The API token identifies the subscription; a guest JWT is obtained from `/auth/guest/start`, retained only in memory, and never logged.

`pnpm txline:probe` validates configuration and prints fixture counts and kickoff bounds only. `pnpm txline:sync-fixtures` upserts normalized fixtures and a checkpoint transactionally. Neither command falls back to synthetic data. `pnpm db:seed-synthetic` restores fictional local data.

Implemented: guest authentication, one refresh after authentication rejection, finite timeout, typed HTTP errors, partial-record rejection, fixture and score normalization, transactional projections, checkpointed SSE, historical import, replay, and database-backed Arena/Admin/detail pages. Missing: odds, trading, predictions, market resolution, settlement, proofs, wallets, and production authentication.
