import Link from "next/link";
import { loadPortfolioPage } from "../page-loaders";
export const dynamic = "force-dynamic";
export default async function Portfolio() {
  const result = await loadPortfolioPage();
  const portfolio = result.state === "loaded" ? result.data : null;
  if (result.state === "failed")
    return (
      <main className="shell">
        <h1>Your positions</h1>
        <section className="card">
          <p>Portfolio data could not be loaded.</p>
        </section>
      </main>
    );
  const committed =
    portfolio?.positions.reduce((sum, position) => sum + position.stakeCredits, 0) ?? 0;
  const payouts =
    portfolio?.positions.reduce((sum, position) => sum + (position.actualPayoutCredits ?? 0), 0) ??
    0;
  return (
    <main className="shell">
      <div className="eyebrow">Demo portfolio</div>
      <h1>Your positions</h1>
      <section className="card">
        <h2>{portfolio?.availableCredits ?? 0} demo credits available</h2>
        <p>
          {portfolio
            ? `${committed} committed · ${payouts} settled payouts`
            : "Start an isolated judge session before purchasing a position."}
        </p>
      </section>
      {portfolio && (
        <>
          <section className="grid">
            {portfolio.positions.map((position) => (
              <article className="card" key={position.id}>
                <h2>{position.market.title}</h2>
                <p>
                  {position.outcome.label} · stake {position.stakeCredits}
                </p>
                <p>
                  {position.settledAt
                    ? `Settled payout: ${position.actualPayoutCredits ?? 0}`
                    : "Open position"}
                </p>
                <Link href={`/arena/${encodeURIComponent(position.market.fixture.sourceId)}`}>
                  View market
                </Link>
                {position.market.receipt && (
                  <p>
                    <Link href={`/proofs/${position.market.receipt.id}`}>
                      View application receipt
                    </Link>
                  </p>
                )}
              </article>
            ))}
          </section>
          <section className="card observations">
            <h2>Ledger history</h2>
            {portfolio.ledgerEntries.map((entry) => (
              <p key={entry.id}>
                {entry.entryType.replaceAll("_", " ")} · {entry.amount > 0 ? "+" : ""}
                {entry.amount} credits
              </p>
            ))}
          </section>
        </>
      )}
    </main>
  );
}
