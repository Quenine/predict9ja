export default async function Proof({ params }: { params: Promise<{ receiptId: string }> }) {
  const { receiptId } = await params;
  return (
    <main className="shell">
      <div className="eyebrow">Settlement proof</div>
      <h1>Receipt</h1>
      <section className="card">
        <p className="meta">Receipt identifier</p>
        <h2>{receiptId}</h2>
        <p>
          Status: pending. Resolution and proof verification are not implemented in this foundation
          batch.
        </p>
      </section>
    </main>
  );
}
