import Link from "next/link";
export default function Home() {
  return (
    <main className="shell">
      <div className="eyebrow">World Cup Arena</div>
      <h1>Live predictions. Verifiable results.</h1>
      <p className="lead">
        Follow football markets from kickoff to an auditable application receipt.
      </p>
      <div className="actions">
        <Link className="button primary" href="/arena">
          Enter the arena
        </Link>
        <Link className="button" href="/judge">
          View judge walkthrough
        </Link>
      </div>
      <section className="grid" aria-label="Product principles">
        <article className="card">
          <h2>Follow</h2>
          <p>See tournament fixtures and clear market outcomes in one mobile-first view.</p>
        </article>
        <article className="card">
          <h2>Predict</h2>
          <p>Build demo-credit positions without wallets, payments or production accounts.</p>
        </article>
        <article className="card">
          <h2>Verify</h2>
          <p>Trace deterministic demo settlement without claiming a TxLINE cryptographic proof.</p>
        </article>
      </section>
    </main>
  );
}
