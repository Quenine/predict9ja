import Link from "next/link";
import {
  FEATURED_REPLAY_SOURCE_ID,
  fixtureProofState,
  fixtureReplayReady,
  formatCatalogueDate,
} from "./arena/catalogue";
import { loadHomePage } from "./page-loaders";

export const dynamic = "force-dynamic";

export default async function Home() {
  const result = await loadHomePage();
  const canonical =
    result.state === "loaded"
      ? result.data.fixtures.filter((fixture) => fixture.sourceMode === "LIVE")
      : [];
  const summary = {
    fixtures: canonical.length,
    verified: canonical.filter((fixture) => fixtureProofState(fixture) === "Proof verified").length,
    replay: canonical.filter(fixtureReplayReady).length,
    sync:
      result.state === "loaded" && result.data.checkpoint?.updatedAt
        ? formatCatalogueDate(result.data.checkpoint.updatedAt)
        : "Temporarily unavailable",
  };
  return (
    <main className="shell home-page">
      <section className="home-hero">
        <div className="eyebrow">Predict9ja World Cup Arena</div>
        <h1>From live football data to verifiable prediction settlement.</h1>
        <p className="lead">
          Predict9ja turns TxLINE match data into auditable fan experiences—combining fixture
          discovery, deterministic demo-credit markets, historical replay and Solana-verified source
          evidence.
        </p>
        <div className="actions">
          <Link className="button primary" href="/judge?mode=replay">
            Run the verified replay
          </Link>
          <Link className="button" href="/arena">
            Explore TxLINE fixtures
          </Link>
        </div>
      </section>

      <section aria-labelledby="product-proof-title">
        <h2 id="product-proof-title">Live product proof</h2>
        <div className="catalogue-summary home-summary">
          <div>
            <strong>{summary.fixtures}</strong>
            <span>Synchronized TxLINE fixtures</span>
          </div>
          <div>
            <strong>{summary.verified}</strong>
            <span>Verified proofs</span>
          </div>
          <div>
            <strong>{summary.replay}</strong>
            <span>Replay-ready fixtures</span>
          </div>
          <div>
            <strong>{summary.sync}</strong>
            <span>Latest successful sync · Africa/Lagos</span>
          </div>
        </div>
        {result.state !== "loaded" && (
          <p className="meta">
            Live catalogue metrics are temporarily unavailable; the verified replay remains
            accessible.
          </p>
        )}
      </section>

      <section className="product-pipeline" aria-labelledby="pipeline-title">
        <h2 id="pipeline-title">An auditable path from source to evidence</h2>
        <ol>
          <li>TxLINE fixtures</li>
          <li>Normalized observations</li>
          <li>Prediction rules</li>
          <li>Deterministic settlement</li>
          <li>Solana-verified evidence</li>
        </ol>
      </section>

      <section className="featured-replay home-feature" aria-labelledby="home-replay-title">
        <div>
          <div className="eyebrow">Featured verified replay</div>
          <h2 id="home-replay-title">England 1–2 Argentina</h2>
          <p>
            Replay stored observations from TxLINE fixture {FEATURED_REPLAY_SOURCE_ID}, make a
            fictional demo-credit prediction and inspect the verified Solana devnet evidence.
          </p>
          <div className="fixture-badges">
            <span className="pill">Final</span>
            <span className="pill">Proof verified</span>
            <span className="pill">Replay available</span>
          </div>
        </div>
        <Link className="button primary" href="/judge?mode=replay">
          Run verified replay
        </Link>
      </section>

      <section className="trust-statement" aria-label="Product trust statement">
        <strong>
          Fictional demo credits only. No deposits, custody or real-value transactions.
        </strong>
        <p>
          TxLINE provides fixture and score data. Predict9ja’s fixed demo quotes are
          application-generated and are not TxLINE odds.
        </p>
      </section>
    </main>
  );
}
