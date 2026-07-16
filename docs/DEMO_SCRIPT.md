# Judge demo script

1. Synchronize fixture `18241006` and ingest a real LIVE score observation.
2. Run `pnpm txline:fetch-proof --fixture-id 18241006 --sequence SEQ --stat-keys 1,2`.
3. Show ordered keys, bounded stat values, proof-node counts, and the TxLINE proof payload digest.
4. Run `pnpm txline:verify-proof --fixture-id 18241006 --sequence SEQ --stat-keys 1,2`.
5. Show the matching devnet program, daily scores PDA, exact predicates, and read-only validation result.
6. State clearly that a current in-play proof is observation evidence, not final settlement evidence.
7. Run the separate synthetic demo-credit settlement and show its Application receipt digest.
8. Do not claim real proof-triggered payout or future real-value settlement.
