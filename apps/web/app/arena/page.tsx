import { displayedScore } from "@predict9ja/domain";
import Link from "next/link";
import type { Metadata } from "next";
import { loadArenaPage } from "../page-loaders";
import {
  FEATURED_REPLAY_SOURCE_ID,
  filterCatalogue,
  fixtureLifecycle,
  fixtureLifecycleLabel,
  fixtureMarketState,
  fixtureProofState,
  fixtureReplayReady,
  formatCatalogueDate,
  ordinaryCatalogue,
  type CatalogueFilter,
} from "./catalogue";

export const dynamic = "force-dynamic";
export const metadata: Metadata = {
  title: "Fixtures",
  description:
    "Explore the current TxLINE devnet fixture catalogue and verified historical replay.",
};
const filters: readonly [CatalogueFilter, string][] = [
  ["all", "All"],
  ["upcoming", "Upcoming"],
  ["live", "Live"],
  ["finished", "Finished"],
  ["verified", "Proof verified"],
  ["replay", "Replay available"],
];

export default async function Arena({
  searchParams,
}: {
  searchParams: Promise<{ filter?: string; q?: string; page?: string }>;
}) {
  const result = await loadArenaPage();
  if (result.state !== "loaded")
    return (
      <main className="shell">
        <h1>Arena unavailable</h1>
        <section className="card">
          <p>Fixture data could not be loaded safely. Please try again shortly.</p>
        </section>
      </main>
    );
  const query = await searchParams;
  const filter = filters.some(([value]) => value === query.filter)
    ? (query.filter as CatalogueFilter)
    : "all";
  const search = query.q ?? "";
  const canonical = result.data.fixtures.filter((fixture) => fixture.sourceMode === "LIVE");
  const featured = canonical.find((fixture) => fixture.sourceId === FEATURED_REPLAY_SOURCE_ID);
  const demo = result.data.fixtures.filter((fixture) => fixture.sourceMode === "SYNTHETIC");
  const ordinary = ordinaryCatalogue(canonical);
  const filtered = filterCatalogue(ordinary, filter, search);
  const pageSize = 24;
  const pages = Math.max(1, Math.ceil(filtered.length / pageSize));
  const page = Math.min(pages, Math.max(1, Number.parseInt(query.page ?? "1", 10) || 1));
  const visible = filtered.slice((page - 1) * pageSize, page * pageSize);
  const counts = [
    ["TxLINE fixtures", canonical.length],
    ["Upcoming", canonical.filter((fixture) => fixtureLifecycle(fixture) === "upcoming").length],
    ["Live now", canonical.filter((fixture) => fixtureLifecycle(fixture) === "live").length],
    ["Finished", canonical.filter((fixture) => fixtureLifecycle(fixture) === "finished").length],
    [
      "Proof verified",
      canonical.filter((fixture) => fixtureProofState(fixture) === "Proof verified").length,
    ],
    ["Replay ready", canonical.filter(fixtureReplayReady).length],
  ] as const;
  return (
    <main className="shell">
      <div className="eyebrow">TxLINE fixture explorer</div>
      <h1>Explore real football fixture data.</h1>
      <p className="lead">
        Canonical fixtures come from TxLINE devnet. Data availability does not imply an active
        prediction market.
      </p>

      {featured && (
        <section className="featured-replay" aria-labelledby="featured-replay-title">
          <div>
            <div className="eyebrow">Featured verified replay</div>
            <h2 id="featured-replay-title">England 1–2 Argentina</h2>
            <p>
              Replay actual stored TxLINE observations, make a fictional prediction, run
              deterministic settlement and inspect the verified source evidence.
            </p>
            <div className="fixture-badges">
              <span className="pill">TxLINE fixture</span>
              <span className="pill">Final</span>
              <span className="pill">Proof verified</span>
              <span className="pill">Solana devnet</span>
              <span className="pill">Replay available</span>
            </div>
          </div>
          <div className="actions">
            <Link className="button primary" href="/judge?mode=replay">
              Run verified replay
            </Link>
            <Link className="button" href={`/arena/${FEATURED_REPLAY_SOURCE_ID}`}>
              Inspect match evidence
            </Link>
          </div>
        </section>
      )}

      <section aria-labelledby="catalogue-summary-title">
        <h2 className="sr-only" id="catalogue-summary-title">
          Catalogue summary
        </h2>
        <div className="catalogue-summary">
          {counts.map(([label, value]) => (
            <div key={label}>
              <strong>{value}</strong>
              <span>{label}</span>
            </div>
          ))}
          <div>
            <strong>
              {result.data.checkpoint?.updatedAt
                ? formatCatalogueDate(result.data.checkpoint.updatedAt)
                : "Not available"}
            </strong>
            <span>Last successful sync · Africa/Lagos</span>
          </div>
        </div>
        <p className="meta">
          Catalogue data is synchronized from the fixtures currently exposed by TxLINE devnet.
        </p>
      </section>

      <form className="catalogue-controls">
        <input
          aria-label="Search by team name"
          name="q"
          placeholder="Search by team name"
          defaultValue={search}
        />
        <input type="hidden" name="filter" value={filter} />
        <button className="button" type="submit">
          Search
        </button>
      </form>
      <nav className="filter-tabs" aria-label="Fixture filters">
        {filters.map(([value, label]) => (
          <Link
            className={filter === value ? "selected" : ""}
            href={`/arena?filter=${value}&q=${encodeURIComponent(search)}`}
            key={value}
          >
            {label}
          </Link>
        ))}
      </nav>

      <section className="fixture-results" aria-labelledby="fixture-results-title">
        <h2 id="fixture-results-title">TxLINE fixtures</h2>
        <p>
          {filtered.length} result{filtered.length === 1 ? "" : "s"}
        </p>
        <div className="grid">
          {visible.map((fixture) => {
            const score = displayedScore(
              fixture.participant1IsHome,
              fixture.scoreProjection?.participant1Goals ?? null,
              fixture.scoreProjection?.participant2Goals ?? null,
            );
            return (
              <article className="card fixture-card" key={fixture.id}>
                <div className="fixture-badges">
                  <span className="pill">{fixtureLifecycleLabel(fixture)}</span>
                  <span className="pill">{fixtureProofState(fixture)}</span>
                </div>
                <p className="meta">TxLINE fixture {fixture.sourceId}</p>
                <h3>
                  <Link href={`/arena/${encodeURIComponent(fixture.sourceId)}`}>
                    {fixture.homeTeam} vs {fixture.awayTeam}
                  </Link>
                </h3>
                {fixture.scoreProjection && (
                  <p className="score">
                    {score.homeScore ?? "–"}–{score.awayScore ?? "–"}
                  </p>
                )}
                <p className="meta">Kickoff {formatCatalogueDate(fixture.startsAt)}</p>
                <p>{fixtureMarketState(fixture)}</p>
                <Link
                  className="button inline-button"
                  href={`/arena/${encodeURIComponent(fixture.sourceId)}`}
                >
                  View match data
                </Link>
              </article>
            );
          })}
        </div>
        {pages > 1 && (
          <div className="pagination">
            {page > 1 && (
              <Link
                href={`/arena?filter=${filter}&q=${encodeURIComponent(search)}&page=${page - 1}`}
              >
                Previous
              </Link>
            )}
            <span>
              Page {page} of {pages}
            </span>
            {page < pages && (
              <Link
                href={`/arena?filter=${filter}&q=${encodeURIComponent(search)}&page=${page + 1}`}
              >
                Next
              </Link>
            )}
          </div>
        )}
      </section>

      <section className="demo-environments observations">
        <div className="section-label synthetic">Demo environments</div>
        <h2>Provider-independent fallback</h2>
        <div className="grid">
          {demo.map((fixture) => (
            <article className="card" key={fixture.id}>
              <div className="fixture-badges">
                <span className="pill">Synthetic</span>
                <span className="pill">Fictional demo markets</span>
              </div>
              <h3>
                {fixture.homeTeam} vs {fixture.awayTeam}
              </h3>
              <p>Fictional deterministic demo environment using demo credits.</p>
              <Link href="/judge?mode=synthetic">Try instant synthetic demo</Link>
            </article>
          ))}
        </div>
      </section>
    </main>
  );
}
