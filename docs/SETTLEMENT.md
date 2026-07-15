# Demo settlement

Resolution creates one idempotent bounded application receipt per market. Its SHA-256 integrity digest uses stable canonical field ordering and covers fixture, market, versioned rule, final observation, provider sequence/time, source mode, action, participant scores/order, resolution state, settlement state, and proof status.

The digest is an application receipt digest, not a TxLINE cryptographic proof. TxLINE proof status remains `NOT_REQUESTED` in Batch 4.

Winning positions receive their stored whole-credit potential payout; losing positions receive zero. Void positions receive their original integer stake. Unique payout/refund references and settled timestamps prevent double payment. Account projection and ledger entry change atomically. `pnpm markets:resolve --fixture-id ID --dry-run` does not write; use `--commit` to resolve and `pnpm markets:settle --fixture-id ID` to settle.
