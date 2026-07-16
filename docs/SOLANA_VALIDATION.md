# Solana read-only validation

Devnet uses program `6pW64gN1s2uqjHkn1unFeEjAwJkPGHoppGvS715wyP2J` and defaults to `https://api.devnet.solana.com`. Mainnet defaults to `https://api.mainnet-beta.solana.com`. TxLINE network, proof network, RPC genesis, configured program, and IDL address must match before validation.

The daily scores PDA uses:

- seed `daily_scores_roots`;
- epoch day `floor(summary.updateStats.minTimestamp / 86400000)`;
- epoch day encoded as unsigned 16-bit little-endian;
- the matching TxLINE program ID.

The first strategy creates two single-stat predicates. Index 0 equals the provider value for requested key 1; index 1 equals the provider value for requested key 2. Every stat is covered once, `geometricTargets` is empty, and `distancePredicate` is null.

Validation invokes `validateStatV2(payload, strategy).view()` with a 1,400,000 compute-unit simulation limit. The wallet is an ephemeral in-memory keypair. No state-changing RPC method, transaction, signature, SOL, wallet file, or fund movement is used.

Batch 5.1 adds txline:diagnose-proof, guarded local diagnostic-wallet mode,
staged legacy/V2 controls, persisted-proof retry, and a redacted support bundle.
See TXLINE_VALIDATION_PARITY.md for field-by-field upstream parity.

RPC failures remain `RPC_UNAVAILABLE`; they are never converted to proof rejection. The vendored artifact is the official devnet IDL, so mainnet validation intentionally fails program matching until an equally pinned official mainnet artifact is integrated.
