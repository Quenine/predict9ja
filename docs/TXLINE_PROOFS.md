# TxLINE score-stat proofs

Predict9ja calls `GET /api/scores/stat-validation` with `fixtureId`, non-zero `seq`, and an ordered comma-separated `statKeys` list. The first exact-score proof requests keys `1,2`; indexes in the V2 strategy refer to this order, not the numeric key.

Responses are strictly normalized. Fixture identity, positional counts, bounded timestamps, non-empty proof arrays, boolean sibling directions, and exactly 32-byte hashes are required. Hashes may use documented byte arrays, hex, or base64. Complete provider responses and proof arrays are never logged or persisted.

The canonical SHA-256 **TxLINE proof payload digest** covers the network, fixture, sequence, ordered keys and values, summary timestamps, roots, proof bytes, and sibling directions. It is neither a Merkle root nor the **Application receipt digest**.

Official devnet artifacts are vendored byte-for-byte from:

- Repository: https://github.com/txodds/tx-on-chain
- Commit: `eba4cb4d578bdb5cfad3c22dfd134f012496e445`
- IDL: `examples/devnet/idl/txoracle.json`
- Generated type: `examples/devnet/types/txoracle.ts`
- IDL SHA-256: `225BF7B0335D4BE64CBE5F42A5A20E1122FE21E244AF1C837574CDEFC9E33ADA`
- Type SHA-256: `3E84B314949F528AEDB5DFC90188CD9FAC906E02410C72E32E69027DF15D6404`

An observed in-play proof is shown as “Verified observation — not final settlement evidence.” Only matching `game_finalised` evidence may be linked to a receipt as final settlement data.
