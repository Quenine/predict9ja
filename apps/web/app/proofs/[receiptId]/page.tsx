import { getReceipt } from "@predict9ja/db";
import { notFound } from "next/navigation";
export const dynamic = "force-dynamic";
export default async function Proof({ params }: { params: Promise<{ receiptId: string }> }) {
  const { receiptId } = await params;
  const receipt = await getReceipt(receiptId);
  if (!receipt) notFound();
  return (
    <main className="shell">
      <div className="eyebrow">Settlement proof</div>
      <h1>Receipt</h1>
      <section className="card">
        <p className="meta">{receipt.market.title}</p>
        <h2>{receipt.winningOutcomeKey ?? "Void"}</h2>
        <p>
          Final score: {receipt.homeScore ?? "–"}–{receipt.awayScore ?? "–"}
        </p>
        <p>Rule: {receipt.ruleVersion}</p>
        <p>
          Source: {receipt.sourceMode} observation #{receipt.providerSequence}
        </p>
        <p>Application resolution: {receipt.resolutionStatus}</p>
        <p>Settlement: {receipt.settlementStatus}</p>
        <p>TxLINE proof status: Not requested</p>
        <p className="digest">
          <strong>Application receipt digest</strong>
          <br />
          {receipt.integrityDigest}
        </p>
        <p>
          This SHA-256 digest protects the bounded application receipt fields. It is not a TxLINE
          cryptographic proof.
        </p>
      </section>
    </main>
  );
}
