import type { Metadata } from "next";
import Link from "next/link";
export const metadata: Metadata = { title: "For Partners" };
export default function Partners() {
  return (
    <main className="shell partners-page">
      <div className="eyebrow">For Partners</div>
      <h1>Turn live sports data into fan experiences people can trust.</h1>
      <p className="lead">
        Predict9ja combines TxLINE match truth with transparent prediction, resolution, accounting
        and evidence layers for sports communities, media companies, tournament organizers, sponsors
        and sports-data developers.
      </p>
      <section>
        <h2>What partners can build</h2>
        <div className="grid">
          <article className="card">
            <h3>Fan campaigns</h3>
            <p>
              Branded prediction campaigns, community prediction leagues and sponsor-led tournament
              experiences.
            </p>
          </article>
          <article className="card">
            <h3>Developer products</h3>
            <p>Prediction and settlement APIs plus verifiable-result dashboards.</p>
          </article>
          <article className="card">
            <h3>White-label experiences</h3>
            <p>Fan journeys tailored to communities, publishers, organizers and sponsors.</p>
          </article>
        </div>
      </section>
      <section>
        <h2>Defensible commercial models</h2>
        <ul className="partner-models">
          <li>Campaign and event licensing</li>
          <li>Community subscriptions</li>
          <li>Enterprise implementation</li>
          <li>API access</li>
          <li>Branded deployments</li>
        </ul>
      </section>
      <section className="trust-statement">
        <strong>
          The current hackathon build uses demo credits only. It does not accept deposits, custody
          funds or operate real-money wagering.
        </strong>
      </section>
      <div className="actions">
        <Link className="button primary" href="/judge?mode=replay">
          Run the verified replay
        </Link>
        <a className="button" href="https://github.com/Quenine/predict9ja">
          View the public repository
        </a>
      </div>
    </main>
  );
}
