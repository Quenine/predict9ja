import { loadAdminPage } from "../page-loaders";
import type { Metadata } from "next";
export const dynamic = "force-dynamic";
export const metadata: Metadata = {
  title: "System diagnostics",
  robots: { index: false, follow: false },
};
export default async function Admin() {
  const result = await loadAdminPage();
  if (result.state !== "loaded")
    return (
      <main className="shell">
        <div className="eyebrow">Internal technical view</div>
        <h1>System diagnostics</h1>
        <section className="card">
          <h2>Operational data unavailable</h2>
          <p>Operational data could not be loaded.</p>
        </section>
      </main>
    );
  const summary = result.data;
  return (
    <main className="shell">
      <div className="eyebrow">Internal technical view</div>
      <h1>System diagnostics</h1>
      <section className="grid">
        <article className="card">
          <h2>Database connected</h2>
          <p>PostgreSQL responded successfully.</p>
        </article>
        <article className="card">
          <h2>Demo workflow</h2>
          <p>Accounts: {summary.accountCount}</p>
          <p>Active markets: {summary.activeMarkets}</p>
          <p>Open positions: {summary.openPositions}</p>
          <p>Unsettled resolved markets: {summary.unsettledMarkets}</p>
          <p>Ledger reconciliation: {summary.ledgerReconciled ? "healthy" : "mismatch"}</p>
          <p>Latest finalised fixture: {summary.latestFinalised?.fixture.sourceId ?? "none"}</p>
        </article>
        <article className="card">
          <h2>Score pipeline</h2>
          <p>{summary.scoreObservations} normalized observations</p>
          <p>Checkpoint: {summary.scoreCheckpoint?.lastProcessedSequence ?? "none"}</p>
          <p>Live stream: {summary.scoreCheckpoint?.connectionStatus ?? "not started"}</p>
          <p>Replay: {summary.replayState?.status ?? "not started"}</p>
        </article>
        <article className="card">
          <h2>Data sources</h2>
          {summary.fixtures.map((x) => (
            <p key={x.sourceMode}>
              {x.sourceMode}: {x._count}
            </p>
          ))}
        </article>
        <article className="card">
          <h2>Proof operations</h2>
          {summary.proofFetchCounts.map((item) => (
            <p key={item.fetchStatus}>
              Fetch {item.fetchStatus}: {item._count}
            </p>
          ))}
          {summary.proofValidationCounts.map((item) => (
            <p key={item.validationStatus}>
              Validation {item.validationStatus}: {item._count}
            </p>
          ))}
          <p>Latest attempt: {summary.latestProofAttempt?.updatedAt.toISOString() ?? "none"}</p>
          <p>
            Latest verified:{" "}
            {summary.latestSuccessfulValidation?.verifiedAt?.toISOString() ?? "none"}
          </p>
          <p>Local/provider mismatches: {summary.localValueMismatches}</p>
          <p>Finalisation proofs: {summary.finalisationProofs}</p>
        </article>
        <article className="card">
          <h2>Solana validation configuration</h2>
          <p>Network: {process.env.TXLINE_NETWORK ?? "devnet"}</p>
          <p>
            Program:{" "}
            {(process.env.TXLINE_NETWORK ?? "devnet") === "devnet"
              ? "6pW64gN1s2uqjHkn1unFeEjAwJkPGHoppGvS715wyP2J"
              : "9ExbZjAapQww1vfcisDmrngPinHTEfpjYRWMunJgcKaA"}
          </p>
        </article>
        <article className="card">
          <h2>Latest fixture sync</h2>
          <p>{summary.checkpoint?.updatedAt.toISOString() ?? "No TxLINE sync recorded."}</p>
        </article>
      </section>
      {process.env.NODE_ENV !== "production" && (
        <section className="card">
          <h2>Safe demo CLI</h2>
          <p>
            <code>pnpm markets:generate-all</code> ·{" "}
            <code>pnpm markets:resolve --fixture-id ID --dry-run</code> ·{" "}
            <code>pnpm markets:settle --fixture-id ID</code> · <code>pnpm demo:reset</code> ·{" "}
            <code>pnpm demo:run</code>
          </p>
        </section>
      )}
      {process.env.NODE_ENV !== "production" && (
        <section className="card">
          <h2>Safe CLI synchronization</h2>
          <p>
            Set server-only TxLINE variables, then run <code>pnpm txline:probe</code> followed by{" "}
            <code>pnpm txline:sync-fixtures</code>. Score commands are{" "}
            <code>pnpm txline:probe-scores --fixture-id ID</code>,{" "}
            <code>pnpm txline:import-history --fixture-id ID</code>,{" "}
            <code>pnpm txline:stream-scores --duration 60</code>, and{" "}
            <code>pnpm txline:replay-scores --fixture-id ID --speed 60</code>. No sync endpoint is
            exposed.
          </p>
        </section>
      )}
    </main>
  );
}
