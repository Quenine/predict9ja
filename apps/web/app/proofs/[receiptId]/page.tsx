import { notFound } from "next/navigation";
import Link from "next/link";
import { loadReceiptPage } from "../../page-loaders";
import { PROOF_LABELS } from "../../proof-labels";
export const dynamic = "force-dynamic";
export default async function Proof({ params }: { params: Promise<{ receiptId: string }> }) {
  const { receiptId } = await params;
  const result = await loadReceiptPage(receiptId);
  if (result.state === "not_found") notFound();
  if (result.state !== "loaded")
    return (
      <main className="shell">
        <h1>Receipt unavailable</h1>
        <section className="card">
          <p>Receipt data could not be loaded.</p>
        </section>
      </main>
    );
  const context = result.data!;
  const receipt = context.receipt;
  const proof = receipt.proofVerification;
  const replayProof = context.replaySourceEvidence;
  const statKeys = proof?.statKeys as number[] | undefined;
  const statValues = proof?.statValues as number[] | undefined;
  const finalEvidence = proof?.settlementEvidenceClassification === "FINAL_SETTLEMENT_VERIFIED";
  return (
    <main className="shell">
      <div className="eyebrow">Application settlement receipt</div>
      <h1>
        {context.receiptContext === "HISTORICAL_REPLAY" ? "Historical TxLINE replay" : "Receipt"}
      </h1>
      <section className="card">
        <h2>Application resolution</h2>
        <p>Rule version: {receipt.ruleVersion}</p>
        <p>
          Final score: {receipt.homeScore ?? "–"}–{receipt.awayScore ?? "–"}
        </p>
        <p>Winning outcome: {receipt.winningOutcomeKey ?? "Void"}</p>
        <p>Settlement status: {receipt.settlementStatus}</p>
        {context.position && (
          <>
            <p>Selected outcome: {context.position.outcome.label}</p>
            <p>Stake: {context.position.stakeCredits} fictional demo credits</p>
            <p>
              Quote: v{context.purchase?.quoteVersion ?? "not available"} ·{" "}
              {context.purchase
                ? `${(context.purchase.priceBasisPoints / 100).toFixed(2)}%`
                : "not available"}
            </p>
            <p>
              Potential payout: {context.position.potentialPayoutCredits} fictional demo credits
            </p>
            <p>Actual payout: {context.position.actualPayoutCredits ?? 0} fictional demo credits</p>
            {context.ledger.map((entry) => (
              <p key={entry.id}>
                {entry.entryType.replaceAll("_", " ").toLowerCase()}: {entry.amount > 0 ? "+" : ""}
                {entry.amount}
              </p>
            ))}
          </>
        )}
        <p className="digest">
          <strong>{PROOF_LABELS.applicationDigest}</strong>
          <br />
          {receipt.integrityDigest}
        </p>
      </section>
      {context.receiptContext === "SYNTHETIC_DEMO" && (
        <section className="card observations">
          <div className="section-label synthetic">Synthetic demo receipt</div>
          <p>
            No TxLINE proof is expected for this fictional fixture. This receipt demonstrates
            Predict9ja’s deterministic rules, ledger accounting and idempotent settlement.
          </p>
          <div className="actions">
            <Link className="button primary" href="/judge?mode=replay">
              Run the real TxLINE replay
            </Link>
            <Link className="button" href="/judge#verified-evidence">
              Inspect canonical verified evidence
            </Link>
          </div>
        </section>
      )}
      {context.receiptContext === "HISTORICAL_REPLAY" && (
        <section className="card observations">
          <div className="section-label real">Verified source evidence</div>
          <h2>Historical TxLINE replay</h2>
          <p>
            This proof verifies the final TxLINE observation used as the source for this historical
            replay. The fictional prediction and payout occurred inside Predict9ja’s isolated demo
            environment.
          </p>
          <dl>
            <dt>Canonical fixture ID</dt>
            <dd>{context.canonicalSourceId}</dd>
            <dt>Provider sequence</dt>
            <dd>{replayProof?.providerSequence ?? "not available"}</dd>
            <dt>Stat keys</dt>
            <dd>
              {Array.isArray(replayProof?.statKeys)
                ? replayProof.statKeys.join(", ")
                : "not available"}
            </dd>
            <dt>Verified values</dt>
            <dd>
              {Array.isArray(replayProof?.statValues)
                ? replayProof.statValues.join(", ")
                : "not available"}
            </dd>
            <dt>Proof digest</dt>
            <dd className="digest">{replayProof?.proofPayloadDigest ?? "not available"}</dd>
            <dt>Network</dt>
            <dd>{replayProof?.network ?? "not available"}</dd>
            <dt>Program ID</dt>
            <dd className="digest">{replayProof?.programId ?? "not available"}</dd>
            <dt>Daily Scores PDA</dt>
            <dd className="digest">{replayProof?.dailyScoresPda ?? "not available"}</dd>
            <dt>Status</dt>
            <dd>{replayProof?.validationStatus ?? "not available"}</dd>
            <dt>Classification</dt>
            <dd>
              {replayProof?.observationClassification === "FINAL_MATCH_OBSERVATION"
                ? "Final match observation verified"
                : "not available"}
            </dd>
          </dl>
        </section>
      )}
      {context.receiptContext === "STANDARD" && (
        <section className="card observations">
          <h2>TxLINE proof</h2>
          <p>Status: {proof?.fetchStatus.replaceAll("_", " ").toLowerCase() ?? "not requested"}</p>
          <p>Fixture ID: {proof?.fixtureSourceId ?? "not available"}</p>
          <p>Sequence: {proof?.providerSequence ?? "not available"}</p>
          <p>Stat keys: {statKeys?.join(", ") ?? "not available"}</p>
          <p>Stat values: {statValues?.join(", ") ?? "not available"}</p>
          <p>Fetched: {proof?.fetchedAt?.toISOString() ?? "not available"}</p>
          <p className="digest">
            <strong>{PROOF_LABELS.txlineDigest}</strong>
            <br />
            {proof?.proofPayloadDigest ?? "not available"}
          </p>
        </section>
      )}
      {context.receiptContext === "STANDARD" && (
        <section className="card observations">
          <h2>{PROOF_LABELS.solanaValidation}</h2>
          <p>
            Status: {proof?.validationStatus.replaceAll("_", " ").toLowerCase() ?? "not requested"}
          </p>
          <p>Network: {proof?.network ?? "not available"}</p>
          <p>Program ID: {proof?.programId ?? "not available"}</p>
          <p>Daily scores PDA: {proof?.dailyScoresPda ?? "not available"}</p>
          <p>Verified: {proof?.verifiedAt?.toISOString() ?? "not available"}</p>
          {proof?.validationStatus === "VERIFIED" && (
            <>
              <p>
                <strong>
                  {proof.observationClassification === "FINAL_MATCH_OBSERVATION"
                    ? "Final match observation verified"
                    : "Verified observation — not final settlement evidence"}
                </strong>
              </p>
              {proof.settlementEvidenceClassification === "FINAL_DATA_VERIFIED_NO_RECEIPT" && (
                <p>No matching market settlement receipt is linked to this proof.</p>
              )}
              {finalEvidence && <p>{PROOF_LABELS.final}</p>}
            </>
          )}
        </section>
      )}
    </main>
  );
}
