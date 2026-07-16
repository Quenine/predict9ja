import { displayedScore } from "@predict9ja/domain";
import Link from "next/link";
import { loadArenaPage } from "../page-loaders";
import { fixtureDisplayState } from "./fixture-display-state";
export const dynamic = "force-dynamic";
export default async function Arena() {
  const result = await loadArenaPage();
  if (result.state !== "loaded")
    return (
      <main className="shell">
        <div className="eyebrow">Tournament fixtures</div>
        <h1>Arena unavailable</h1>
        <section className="card">
          <p>Fixture data could not be loaded.</p>
        </section>
      </main>
    );
  const fixtures = result.data;
  return (
    <main className="shell">
      <div className="eyebrow">Tournament fixtures</div>
      <h1>Arena</h1>
      {fixtures.length === 0 ? (
        <section className="card">
          <h2>No fixtures yet</h2>
          <p>
            Run <code>pnpm db:seed-synthetic</code> for fictional development data or{" "}
            <code>pnpm txline:sync-fixtures</code> with valid TxLINE configuration.
          </p>
        </section>
      ) : (
        <section className="grid">
          {fixtures.map((f) => {
            const displayState = fixtureDisplayState(f.status, f.scoreProjection);
            return (
              <article className="card" key={f.id}>
                <span className="pill">
                  {f.sourceMode === "SYNTHETIC" ? "Synthetic fixture" : "TxLINE fixture"}
                </span>
                <h2>
                  <Link href={`/arena/${encodeURIComponent(f.sourceId)}`}>
                    {f.homeTeam} vs {f.awayTeam}
                  </Link>
                </h2>
                {f.scoreProjection &&
                  (() => {
                    const score = displayedScore(
                      f.participant1IsHome,
                      f.scoreProjection.participant1Goals,
                      f.scoreProjection.participant2Goals,
                    );
                    return (
                      <p className="score">
                        {score.homeScore ?? "–"}–{score.awayScore ?? "–"}{" "}
                        <span className="meta">{displayState}</span>
                      </p>
                    );
                  })()}
                <p className="meta">
                  {f.startsAt.toLocaleString("en-NG", { timeZone: "Africa/Lagos" })} ·{" "}
                  {displayState}
                </p>
                {f.status === "CANCELLED" && (
                  <p>
                    <strong>Cancelled</strong>
                  </p>
                )}
                {f.markets.map((m) => (
                  <p key={m.id}>
                    {m.title} · {m.status.toLowerCase()}
                  </p>
                ))}
              </article>
            );
          })}
        </section>
      )}
    </main>
  );
}
