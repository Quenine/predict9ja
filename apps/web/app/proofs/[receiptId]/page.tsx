import { notFound } from "next/navigation";
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
  const receipt = result.data!;
  const proof = receipt.proofVerification;
  const statKeys = proof?.statKeys as number[] | undefined;
  const statValues = proof?.statValues as number[] | undefined;
  const finalEvidence = proof?.settlementEvidenceClassification === "FINAL_SETTLEMENT_VERIFIED";
  return (
    <main className="shell">
      <div className="eyebrow">Settlement proof</div>
      <h1>Receipt</h1>
      <section className="card">
        <h2>Application resolution</h2>
        <p>Rule version: {receipt.ruleVersion}</p>
        <p>
          Final score: {receipt.homeScore ?? "–"}–{receipt.awayScore ?? "–"}
        </p>
        <p>Winning outcome: {receipt.winningOutcomeKey ?? "Void"}</p>
        <p>Settlement status: {receipt.settlementStatus}</p>
        <p className="digest">
          <strong>{PROOF_LABELS.applicationDigest}</strong>
          <br />
          {receipt.integrityDigest}
        </p>
      </section>
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
    </main>
  );
}
