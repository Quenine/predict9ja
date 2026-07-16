# TxLINE validation parity

Pinned upstream: TxODDS tx-on-chain commit
eba4cb4d578bdb5cfad3c22dfd134f012496e445.

| Concern             | Official devnet example                     | Predict9ja                                                                            |
| ------------------- | ------------------------------------------- | ------------------------------------------------------------------------------------- |
| IDL/type            | examples/devnet IDL and generated type      | Byte-for-byte vendored artifacts; hashes recorded in Batch 5                          |
| Program             | IDL address                                 | Anchor Program from the same IDL; configured ID must equal IDL address                |
| Provider            | connection plus wallet                      | Ephemeral keypair by default; guarded CLI-only local diagnostic keypair optionally    |
| Mutation            | view simulation                             | view only; no send/sign-and-send path                                                 |
| targetTs            | summary.updateStats.minTimestamp            | Exactly minTimestamp; response-root ts is retained only as proof metadata             |
| Epoch day           | floor targetTs / 86,400,000                 | Identical, range checked for the u16 seed                                             |
| Epoch encoding      | BN little-endian, two bytes                 | Explicit writeUInt16LE                                                                |
| Fixture summary     | fixture ID, update stats, eventsSubTreeRoot | Same Anchor field names; provider eventStatsSubTreeRoot maps to IDL eventsSubTreeRoot |
| Fixture/main proofs | ordered nodes and sibling direction         | Preserved positionally without sorting                                                |
| Event-stat root     | provider root                               | Copied as 32 bytes                                                                    |
| Stats/proofs        | statsToProve[i] with statProofs[i]          | Count/order checked and mapped positionally                                           |
| Compute budget      | 1,400,000 units                             | Identical pre-instruction                                                             |
| Root account        | dailyScoresMerkleRoots                      | Identical Anchor account name                                                         |
| Legacy strategy     | one stat term plus trader predicate         | Exact equality against returned key-1 value                                           |
| V2 strategy         | N-dimensional discrete predicates           | One equality predicate per stat index, with complete one-time coverage                |

The response-root ts may differ from the fixture batch minimum. It is preserved and
included in the canonical digest, but the official program example derives both
targetTs and the daily-root PDA from summary.updateStats.minTimestamp.

Diagnostics stop before program invocation when RPC, wallet, program, or root-account
preflight fails. Program logs are bounded to 20 lines of 300 characters and redact
base58 addresses except the configured public program and root PDA.

Batch 5.2 removes the former execution split: diagnostic Stage D, verify-proof,
verify-latest-score, and retry-verification all resolve the provider through the
same CLI-only resolver and invoke the same shared preflight plus V2 view function.
