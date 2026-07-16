# Solana validation

Devnet validation uses program 6pW64gN1s2uqjHkn1unFeEjAwJkPGHoppGvS715wyP2J and an IDL-pinned read-only validateStatV2 view. Network, proof network, RPC genesis, program, IDL, PDA, and predicates must agree.

Fixture 18241006 sequence 962 values 1,2 is VERIFIED against daily scores PDA HJ6nSVkUs4VG9JQ5sEUq3VbmyUSBf76ePXUCATLtRYTX.

Normal validation may use an ephemeral provider. Guarded CLI diagnostics may use a disposable funded devnet wallet because simulation can require an existing payer. Secret bytes and paths are never persisted, logged, bundled, or sent to TxLINE. No transaction is submitted. Failed preflight is never described as successful execution.
