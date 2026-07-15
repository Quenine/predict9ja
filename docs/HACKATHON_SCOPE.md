# Hackathon scope

Batch 4 adds isolated anonymous demo sessions, ledger-backed demo-credit purchases, synthetic basis-point quotes, deterministic resolution/settlement, and bounded application receipts. It does not add real-money features, TxLINE odds or proofs, Solana validation, selling, or production authentication.

Predict9ja World Cup Arena demonstrates the path from a football fixture to a prediction market, demo-credit position, deterministic outcome, and proof-backed settlement receipt.

This first batch establishes repository, UI, domain, data, and ingestion boundaries. TxLINE is the intended primary sports-data source, but live authentication, requests, and streams are not implemented. Hackathon transactions use demo credits. Real-money products, Naira settlement, production crypto settlement, wallets, paid services, and production authentication are outside the submission scope.

The application must remain testable without a wallet or paid service. Codex assists implementation; the project is reviewed, controlled, and submitted by its human owner.

Batch 3 implements credential-gated TxLINE score snapshots, history, SSE ingestion, and deterministic replay. It does not implement odds, trading, balances, predictions, market resolution, settlement, or proofs.
