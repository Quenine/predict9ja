# Demo credits

Predict9ja uses integer demonstration credits. No money can be deposited, withdrawn, transferred, or redeemed. Each anonymous browser session receives 10,000 credits through a `SESSION_GRANT` ledger entry.

`DemoAccount.availableCredits` is a transactionally maintained projection, not the sole record. Every change has one uniquely referenced append-only `CreditLedgerEntry`: session grant, position purchase, settlement payout, void refund, or explicit reset. Reconciliation requires the signed ledger sum to equal the available balance. A PostgreSQL check constraint and conditional debit prevent negative balances.

Quotes use integer basis points: 10,000 equals 100%. Active outcomes in a market sum to exactly 10,000. Shares use microshares (1,000,000 microshares per whole share). Purchase shares are `floor(stake × 10,000 × 1,000,000 / priceBasisPoints)`; potential payout is the whole-credit floor of microshares. This deterministic rounding never rounds a payout upward.
