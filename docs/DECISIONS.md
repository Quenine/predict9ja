# Architecture decisions

1. TxLINE is the external sports-evidence authority.
2. JWTs and API tokens remain server-only and are never logged.
3. Raw responses are not archived; strict normalized records are persisted.
4. A bounded normalized proof envelope and digest support deterministic retry.
5. Ordered stat keys are part of identity.
6. Solana validation is read-only and IDL/program/network pinned.
7. Normal validation may use an ephemeral provider; guarded diagnostics may use a disposable funded devnet wallet.
8. Wallet secret bytes and paths are never persisted or logged.
9. Explicit live game_finalised plus finalised=true is authoritative finality.
10. Observation finality and receipt linkage are separate classifications.
11. Fixture 18241006 sequence 962 score 1–2 is verified with no linked real-market receipt.
12. Demo-credit markets are isolated and have no monetary value.
