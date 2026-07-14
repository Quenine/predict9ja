# Decisions

1. TxLINE is the primary sports-data source. This repository currently defines its boundary without inventing provider fields.
2. The web app and persistent ingestion worker are separate processes.
3. Hackathon transactions use integer demo credits with no cash value.
4. Real-money, Naira, and production crypto settlement are outside submission scope.
5. Raw TxLINE datasets and credentials must not be committed. Only normalized operational and settlement data is stored.
6. Synthetic mode keeps the application testable without a wallet or paid service.
7. Market rule identifiers are versioned and unique per fixture to preserve resolution semantics.
8. Codex is an implementation assistant; the human owner reviews, controls, and submits the project.

9. TxLINE origins are selected only by devnet/mainnet; host overrides are test injection only.
10. Malformed snapshot records are counted and rejected individually without raw-payload persistence.
