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
  const metrics = [
    ["TxLINE matches", canonical.length],
    [
      "Verified results",
      canonical.filter((fixture) => fixtureProofState(fixture) === "Result verified").length,
    ],
    ["Replay ready", canonical.filter(fixtureReplayReady).length],
    [
      "Latest sync",
      result.state === "loaded" && result.data.checkpoint?.updatedAt
        ? formatCatalogueDate(result.data.checkpoint.updatedAt)
        : "Temporarily unavailable",
    ],
  ] as const;
  return (
    <main className="shell home-page">
      <section className="home-hero">
        <div className="eyebrow">Football predictions you can verify</div>
        <h1>Predict the match. Replay the action. Verify the result.</h1>
        <p className="lead">
          Explore tournament matches, make picks with demo credits, replay real TxLINE match updates
          and see exactly how every result was settled.
        </p>
        <div className="actions">
          <Link className="button primary" href="/judge?mode=replay">
            Replay England vs Argentina
          </Link>
          <Link className="button" href="/arena">
            Explore matches
          </Link>
        </div>
      </section>
      <section aria-labelledby="benefits-title">
        <h2 id="benefits-title">Football experiences with the result in view</h2>
        <div className="grid">
          <article className="card">
            <h3>Follow the match</h3>
            <p>Browse the fixtures currently available through TxLINE devnet.</p>
          </article>
          <article className="card">
            <h3>Make your pick</h3>
            <p>Choose an outcome using demo credits with no deposit or wallet required.</p>
          </article>
          <article className="card">
            <h3>Verify the result</h3>
            <p>See the match updates, settlement rules and evidence behind the final result.</p>
          </article>
        </div>
      </section>
      <section aria-labelledby="product-proof-title">
        <h2 id="product-proof-title">Live product proof</h2>
        <div className="catalogue-summary home-summary">
          {metrics.map(([label, value]) => (
            <div key={label}>
              <strong>{value}</strong>
              <span>{label}</span>
            </div>
          ))}
        </div>
        {result.state !== "loaded" && (
          <p className="meta">
            Live match metrics are temporarily unavailable; the replay remains accessible.
          </p>
        )}
      </section>
      <section className="product-pipeline" aria-labelledby="pipeline-title">
        <h2 id="pipeline-title">From match update to verified result</h2>
        <p>
          TxLINE powers the match data. Predict9ja applies clear settlement rules. Solana-backed
          proof checks the final source data.
        </p>
        <ol>
          <li>TxLINE matches</li>
          <li>Normalized updates</li>
          <li>Prediction rules</li>
          <li>Rules-based settlement</li>
          <li>Verified source evidence</li>
        </ol>
      </section>
      <section className="featured-replay home-feature">
        <div>
          <div className="eyebrow">Verified match replay</div>
          <h2>England 1–2 Argentina</h2>
          <p>
            Replay stored updates from TxLINE match {FEATURED_REPLAY_SOURCE_ID}, make a pick with
            demo credits and inspect the verified source evidence.
          </p>
        </div>
        <Link className="button primary" href="/judge?mode=replay">
          Replay & predict
        </Link>
      </section>
      <section className="partner-teaser">
        <div>
          <h2>Building a sports community, fan campaign or data product?</h2>
          <p>See how Predict9ja can power trustworthy fan experiences.</p>
        </div>
        <Link className="button" href="/partners">
          Explore Predict9ja for partners
        </Link>
      </section>
    </main>
  );
}
