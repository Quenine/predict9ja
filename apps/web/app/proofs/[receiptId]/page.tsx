import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { loadReceiptPage } from "../../page-loaders";
export const dynamic = "force-dynamic";
export const metadata: Metadata = {
  title: "Prediction receipt",
  description: "Inspect deterministic application settlement and its available source evidence.",
};

export default async function ReceiptPage({ params }: { params: Promise<{ receiptId: string }> }) {
  const { receiptId } = await params;
  const result = await loadReceiptPage(receiptId);
  if (result.state === "not_found") notFound();
  if (result.state !== "loaded")
    return (
      <main className="shell">
        <h1>Prediction receipt unavailable</h1>
        <section className="card">
          <p>Receipt data could not be loaded safely.</p>
        </section>
      </main>
    );
  const context = result.data!;
  const receipt = context.receipt;
  const fixture = receipt.market.fixture;
  const replayProof = context.replaySourceEvidence;
  const replayStatKeys = Array.isArray(replayProof?.statKeys)
    ? (replayProof.statKeys as number[])
    : null;
  const replayStatValues = Array.isArray(replayProof?.statValues)
    ? (replayProof.statValues as number[])
    : null;
  const status =
    receipt.settlementStatus === "VOID"
      ? "void"
      : (context.position?.actualPayoutCredits ?? 0) > 0
        ? "won"
        : "lost";
  const resultStatus =
    receipt.settlementStatus === "VOID"
      ? "Refunded"
      : receipt.settlementStatus === "SETTLED"
        ? "Completed"
        : receipt.settlementStatus.replaceAll("_", " ").toLowerCase();
  return (
    <main className="shell receipt-page">
      <div className="eyebrow">Application settlement receipt</div>
      <h1>Prediction receipt</h1>
      <h2>
        {fixture.homeTeam} vs {fixture.awayTeam}
      </h2>
      <div className="fixture-badges">
        <span className="pill">
          {status === "void" ? "Refunded" : status.charAt(0).toUpperCase() + status.slice(1)}
        </span>
        <span className="pill">Demo credits</span>
      </div>
      <p className="lead">
        Final score {receipt.homeScore ?? "–"}–{receipt.awayScore ?? "–"} · Rule{" "}
        {receipt.ruleVersion}
      </p>
      <h2>How the result was decided</h2>
      <ol className="provenance-chain" aria-label="Settlement provenance">
        <li>Pick placed</li>
        <li>
          {context.receiptContext === "SYNTHETIC_DEMO"
            ? "Demo events generated"
            : "Match updates received"}
        </li>
        <li>Full time confirmed</li>
        <li>Rules checked</li>
        <li>Demo credits settled</li>
        <li>Receipt created</li>
      </ol>
      <section className="card observations">
        <h2>Prediction settlement</h2>
        <dl>
          <dt>Prediction</dt>
          <dd>{receipt.market.title}</dd>
          <dt>Selected outcome</dt>
          <dd>{context.position?.outcome.label ?? "Not available"}</dd>
          <dt>Demo-credit stake</dt>
          <dd>{context.position?.stakeCredits.toLocaleString() ?? "0"} credits</dd>
          <dt>Demo return</dt>
          <dd>{(context.position?.actualPayoutCredits ?? 0).toLocaleString()} credits</dd>
          <dt>Final score</dt>
          <dd>
            {receipt.homeScore ?? "–"}–{receipt.awayScore ?? "–"}
          </dd>
          <dt>Result status</dt>
          <dd>{resultStatus}</dd>
          <dt>Rules used</dt>
          <dd>{receipt.ruleVersion}</dd>
          <dt>Receipt integrity</dt>
          <dd className="digest">{receipt.integrityDigest}</dd>
        </dl>
      </section>
      {context.receiptContext === "HISTORICAL_REPLAY" && (
        <section className="card observations">
          <div className="section-label real">Match-data source</div>
          <h2>Technical evidence</h2>
          <dl>
            <dt>Canonical fixture</dt>
            <dd>{context.canonicalSourceId}</dd>
            <dt>Authoritative sequence</dt>
            <dd>{replayProof?.providerSequence ?? "not available"}</dd>
            <dt>Stat keys and values</dt>
            <dd>
              {replayStatKeys && replayStatValues
                ? replayStatKeys
                    .map((key, index) => `${key}: ${replayStatValues[index]}`)
                    .join(", ")
                : "not available"}
            </dd>
            <dt>TxLINE proof digest</dt>
            <dd className="digest">{replayProof?.proofPayloadDigest ?? "not available"}</dd>
            <dt>Network</dt>
            <dd>{replayProof?.network ?? "not available"}</dd>
            <dt>Program</dt>
            <dd className="digest">{replayProof?.programId ?? "not available"}</dd>
            <dt>Daily Scores PDA</dt>
            <dd className="digest">{replayProof?.dailyScoresPda ?? "not available"}</dd>
            <dt>Validation status</dt>
            <dd>{replayProof?.validationStatus ?? "not available"}</dd>
          </dl>
        </section>
      )}
      {context.receiptContext === "SYNTHETIC_DEMO" && (
        <section className="card observations">
          <div className="section-label synthetic">Prediction receipt</div>
          <h2>How the result was decided</h2>
          <p>
            No TxLINE proof is expected for this fictional fixture. This receipt demonstrates
            deterministic application rules, ledger accounting and idempotent settlement.
          </p>
          <Link className="button primary inline-button" href="/judge?mode=replay">
            Run verified TxLINE replay
          </Link>
        </section>
      )}
      <section className="integrity-grid">
        <article className="card">
          <h2>What this proves</h2>
          <p>
            The application receipt records the selected fictional position, final score,
            deterministic rule version, settlement status, payout and integrity digest. For
            historical replay, the separate source evidence verifies the canonical TxLINE
            observation at sequence 962.
          </p>
        </article>
        <article className="card">
          <h2>What this does not prove</h2>
          <p>
            The TxLINE proof does not prove the fictional prediction existed before the original
            match and does not validate the fictional payout. No real money, custody or real-market
            settlement occurred.
          </p>
        </article>
      </section>
      <div className="actions">
        <Link className="button primary" href="/portfolio">
          My Picks
        </Link>
        <Link
          className="button"
          href={
            context.receiptContext === "SYNTHETIC_DEMO"
              ? "/judge?mode=synthetic"
              : "/judge?mode=replay"
          }
        >
          Run again
        </Link>
      </div>
    </main>
  );
}
