import { displayedScore } from "@predict9ja/domain";
import Link from "next/link";
import { loadArenaPage } from "../page-loaders";
import {
  filterCatalogue,
  fixtureProofState,
  fixtureReplayReady,
  type CatalogueFilter,
} from "./catalogue";
import { fixtureDisplayState } from "./fixture-display-state";

export const dynamic = "force-dynamic";
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
          <p>Fixture data could not be loaded.</p>
        </section>
      </main>
    );
  const query = await searchParams;
  const filter = filters.some(([value]) => value === query.filter)
    ? (query.filter as CatalogueFilter)
    : "all";
  const search = query.q ?? "";
  const canonical = result.data.fixtures.filter((fixture) => fixture.sourceMode === "LIVE");
  const demo = result.data.fixtures.filter((fixture) => fixture.sourceMode === "SYNTHETIC");
  const filtered = filterCatalogue(canonical, filter, search);
  const pageSize = 24;
  const pages = Math.max(1, Math.ceil(filtered.length / pageSize));
  const page = Math.min(pages, Math.max(1, Number.parseInt(query.page ?? "1", 10) || 1));
  const visible = filtered.slice((page - 1) * pageSize, page * pageSize);
  const counts = {
    stored: canonical.length,
    upcoming: canonical.filter((fixture) => fixture.status === "SCHEDULED").length,
    live: canonical.filter((fixture) => fixture.status === "LIVE").length,
    finished: canonical.filter(
      (fixture) => fixture.status === "FINISHED" || fixture.scoreProjection?.finalised,
    ).length,
    verified: canonical.filter((fixture) => fixtureProofState(fixture) === "Verified").length,
    replay: canonical.filter(fixtureReplayReady).length,
  };
  const cards = (fixtures: typeof visible) =>
    fixtures.map((fixture) => {
      const score = displayedScore(
        fixture.participant1IsHome,
        fixture.scoreProjection?.participant1Goals ?? null,
        fixture.scoreProjection?.participant2Goals ?? null,
      );
      const state = fixtureDisplayState(fixture.status, fixture.scoreProjection);
      const proof = fixtureProofState(fixture);
      const replay = fixtureReplayReady(fixture);
      return (
        <article
          className={`card fixture-card ${fixture.sourceId === "18241006" ? "featured-fixture" : ""}`}
          key={fixture.id}
        >
          <div className="fixture-badges">
            <span className="pill">TxLINE</span>
            <span className="pill">{proof}</span>
            {replay && <span className="pill">Replay available</span>}
          </div>
          <h2>
            <Link href={`/arena/${encodeURIComponent(fixture.sourceId)}`}>
              {fixture.homeTeam} vs {fixture.awayTeam}
            </Link>
          </h2>
          {fixture.scoreProjection && (
            <p className="score">
              {score.homeScore ?? "–"}–{score.awayScore ?? "–"}{" "}
              <span className="meta">{state}</span>
            </p>
          )}
          <p className="meta">
            Kickoff {fixture.startsAt.toLocaleString("en-NG", { timeZone: "Africa/Lagos" })}
          </p>
          <p className="meta">
            Markets:{" "}
            {fixture.markets.length
              ? [...new Set(fixture.markets.map((market) => market.status.toLowerCase()))].join(
                  ", ",
                )
              : "not opened"}
          </p>
          <p className="meta">
            Data updated {fixture.updatedAt.toLocaleString("en-NG", { timeZone: "Africa/Lagos" })}
          </p>
          {replay && (
            <Link className="button primary inline-button" href="/judge?mode=replay">
              Run verified replay
            </Link>
          )}
        </article>
      );
    });
  return (
    <main className="shell">
      <div className="eyebrow">TxLINE fixture explorer</div>
      <h1>Explore verified football data.</h1>
      <section className="catalogue-summary">
        {Object.entries(counts).map(([label, value]) => (
          <div key={label}>
            <strong>{value}</strong>
            <span>{label.replaceAll("_", " ")}</span>
          </div>
        ))}
        <div>
          <strong>
            {result.data.checkpoint?.updatedAt.toLocaleString("en-NG", {
              timeZone: "Africa/Lagos",
            }) ?? "Not available"}
          </strong>
          <span>last successful fixture sync</span>
        </div>
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
      <section className="fixture-results">
        <h2>TxLINE fixtures</h2>
        <p>
          {filtered.length} result{filtered.length === 1 ? "" : "s"}
        </p>
        <div className="grid">{cards(visible)}</div>
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
              <span className="pill">Synthetic</span>
              <h2>
                {fixture.homeTeam} vs {fixture.awayTeam}
              </h2>
              <p>Fictional deterministic demo environment.</p>
              <Link href="/judge?mode=synthetic">Try instant synthetic demo</Link>
            </article>
          ))}
        </div>
      </section>
    </main>
  );
}
