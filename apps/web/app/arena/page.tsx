import { listFixturesWithMarkets } from "@predict9ja/db";
import { displayedScore } from "@predict9ja/domain";
import Link from "next/link";
export const dynamic = "force-dynamic";
export default async function Arena() {
  try {
    const fixtures = await listFixturesWithMarkets();
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
            {fixtures.map((f) => (
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
                        <span className="meta">
                          {f.scoreProjection.latestPhase.replaceAll("_", " ").toLowerCase()}
                        </span>
                      </p>
                    );
                  })()}
                <p className="meta">
                  {f.startsAt.toLocaleString("en-NG", { timeZone: "Africa/Lagos" })} ·{" "}
                  {f.status === "UNKNOWN" ? "Provider state unknown" : f.status.toLowerCase()}
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
            ))}
          </section>
        )}
      </main>
    );
  } catch {
    return (
      <main className="shell">
        <div className="eyebrow">Tournament fixtures</div>
        <h1>Arena unavailable</h1>
        <section className="card">
          <p>
            The database could not be reached. Start local PostgreSQL and apply migrations, then try
            again.
          </p>
        </section>
      </main>
    );
  }
}
