# Decisions

11. Browser demo identity comes only from an HttpOnly opaque session cookie; request bodies never select accounts.
12. Demo balances reconcile to uniquely referenced append-only ledger entries.
13. Quotes and share calculations use basis points and microshares with floor rounding.
14. Application receipt digests are distinct from future TxLINE proofs.

15. TxLINE is the primary sports-data source. This repository currently defines its boundary without inventing provider fields.
16. The web app and persistent ingestion worker are separate processes.
17. Hackathon transactions use integer demo credits with no cash value.
18. Real-money, Naira, and production crypto settlement are outside submission scope.
19. Raw TxLINE datasets and credentials must not be committed. Only normalized operational and settlement data is stored.
20. Synthetic mode keeps the application testable without a wallet or paid service.
21. Market rule identifiers are versioned and unique per fixture to preserve resolution semantics.
22. Codex is an implementation assistant; the human owner reviews, controls, and submits the project.

23. TxLINE origins are selected only by devnet/mainnet; host overrides are test injection only.
24. Malformed snapshot records are counted and rejected individually without raw-payload persistence.
