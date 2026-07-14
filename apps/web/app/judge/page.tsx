export default function Judge() {
  return (
    <main className="shell">
      <div className="eyebrow">Judge walkthrough</div>
      <h1>Fixture data foundation</h1>
      <section className="grid">
        <article className="card">
          <h2>1. Local data</h2>
          <p>PostgreSQL stores seeded synthetic fixtures and normalized TxLINE snapshots.</p>
        </article>
        <article className="card">
          <h2>2. Safe synchronization</h2>
          <p>
            The worker can authenticate and synchronize fixture snapshots when a valid TxLINE API
            token is configured.
          </p>
        </article>
        <article className="card">
          <h2>3. Score evidence</h2>
          <p>
            Normalized score observations and replay are implemented. Trading, odds, market
            resolution, settlement and proof validation are not implemented.
          </p>
        </article>
      </section>
    </main>
  );
}
