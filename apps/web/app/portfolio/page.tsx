import type { Metadata } from "next";
import Link from "next/link";
import { loadPortfolioPage } from "../page-loaders";
import { positionStatus } from "./presentation";
export const dynamic = "force-dynamic";
export const metadata: Metadata = {
  title: "My predictions",
  description:
    "Review fictional demo-credit predictions, settlement results and application receipts.",
};

export default async function Portfolio() {
  const result = await loadPortfolioPage();
  const portfolio = result.state === "loaded" ? result.data : null;
  if (result.state === "failed")
    return (
      <main className="shell">
        <h1>My predictions</h1>
        <section className="card">
          <p>Prediction history could not be loaded safely.</p>
        </section>
      </main>
    );
  if (!portfolio)
    return (
      <main className="shell">
        <div className="eyebrow">Fictional demo portfolio</div>
        <h1>My predictions</h1>
        <section className="card empty-state">
          <h2>Start a judge session to see your predictions</h2>
          <p>
            Each browser session receives isolated fictional credits. No wallet, deposit or
            real-value transaction is required.
          </p>
          <div className="actions">
            <Link className="button primary" href="/judge?mode=replay">
              Run verified replay
            </Link>
            <Link className="button" href="/judge?mode=synthetic">
              Run synthetic demo
            </Link>
          </div>
        </section>
      </main>
    );
  const staked = portfolio.positions.reduce((sum, position) => sum + position.stakeCredits, 0);
  const payouts = portfolio.positions.reduce(
    (sum, position) => sum + (position.actualPayoutCredits ?? 0),
    0,
  );
  const settled = portfolio.positions.filter((position) => position.settledAt).length;
  const metrics = [
    ["Fictional credits available", portfolio.availableCredits],
    ["Total staked", staked],
    ["Total payouts", payouts],
    ["Net demo result", payouts - staked],
    ["Open positions", portfolio.positions.length - settled],
    ["Settled positions", settled],
  ] as const;
  return (
    <main className="shell">
      <div className="eyebrow">Fictional demo portfolio</div>
      <h1>My predictions</h1>
      <p className="lead">
        A readable record of this browser session’s fictional positions and deterministic
        settlements.
      </p>
      <section className="catalogue-summary">
        {metrics.map(([label, value]) => (
          <div key={label}>
            <strong>
              {value > 0 && label === "Net demo result" ? "+" : ""}
              {value.toLocaleString()}
            </strong>
            <span>{label}</span>
          </div>
        ))}
      </section>
      <section>
        <h2>Positions</h2>
        <div className="grid">
          {portfolio.positions.map((position) => {
            const status = positionStatus(position);
            const receipt = position.market.receipt;
            const fixture = position.market.fixture;
            return (
              <article className="card position-card" key={position.id}>
                <div className="fixture-badges">
                  <span className="pill">{status}</span>
                  <span className="pill">Fictional credits</span>
                </div>
                <h3>
                  {fixture.homeTeam} vs {fixture.awayTeam}
                </h3>
                <dl>
                  <dt>Market</dt>
                  <dd>{position.market.title}</dd>
                  <dt>Selected outcome</dt>
                  <dd>{position.outcome.label}</dd>
                  <dt>Stake</dt>
                  <dd>{position.stakeCredits.toLocaleString()}</dd>
                  <dt>Potential payout</dt>
                  <dd>{position.potentialPayoutCredits.toLocaleString()}</dd>
                  <dt>Actual payout</dt>
                  <dd>{(position.actualPayoutCredits ?? 0).toLocaleString()}</dd>
                  {receipt && (
                    <>
                      <dt>Final score</dt>
                      <dd>
                        {receipt.homeScore ?? "–"}–{receipt.awayScore ?? "–"}
                      </dd>
                    </>
                  )}
                </dl>
                {receipt && (
                  <Link className="button primary inline-button" href={`/proofs/${receipt.id}`}>
                    View application receipt
                  </Link>
                )}
                <Link
                  className="inline-button"
                  href={
                    fixture.sourceMode === "REPLAY"
                      ? "/judge?mode=replay"
                      : fixture.sourceMode === "SYNTHETIC"
                        ? "/judge?mode=synthetic"
                        : `/arena/${fixture.sourceId}`
                  }
                >
                  View{" "}
                  {fixture.sourceMode === "REPLAY"
                    ? "replay"
                    : fixture.sourceMode === "SYNTHETIC"
                      ? "demo"
                      : "match"}
                </Link>
              </article>
            );
          })}
        </div>
      </section>
      <section className="card observations ledger-timeline">
        <h2>Fictional credit timeline</h2>
        {portfolio.ledgerEntries.map((entry) => {
          const label =
            entry.entryType === "SESSION_GRANT"
              ? "Credit grant"
              : entry.entryType === "POSITION_PURCHASE"
                ? "Position purchase"
                : entry.entryType === "SETTLEMENT_PAYOUT"
                  ? "Settlement payout"
                  : entry.entryType.replaceAll("_", " ").toLowerCase();
          const receipt = portfolio.positions.find((position) => position.id === entry.positionId)
            ?.market.receipt;
          return (
            <article key={entry.id}>
              <div>
                <strong>{label}</strong>
                <small>
                  {entry.createdAt.toLocaleString("en-NG", { timeZone: "Africa/Lagos" })}
                </small>
              </div>
              <strong>
                {entry.amount > 0 ? "+" : ""}
                {entry.amount.toLocaleString()} credits
              </strong>
              {receipt && <Link href={`/proofs/${receipt.id}`}>Receipt</Link>}
            </article>
          );
        })}
      </section>
      <p className="integrity-note">
        Demo results are fictional accounting outcomes, not financial profit or real value.
      </p>
    </main>
  );
}
