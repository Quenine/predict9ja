import { getFixtureDetails } from "@predict9ja/db";
import { displayedScore, displayedTeams } from "@predict9ja/domain";
import { notFound } from "next/navigation";
export const dynamic = "force-dynamic";
export default async function FixtureDetails({
  params,
}: {
  params: Promise<{ fixtureId: string }>;
}) {
  const { fixtureId } = await params;
  const fixture = await getFixtureDetails(decodeURIComponent(fixtureId));
  if (!fixture) notFound();
  const teams = displayedTeams(fixture);
  const projection = fixture.scoreProjection;
  const score = displayedScore(
    fixture.participant1IsHome,
    projection?.participant1Goals ?? null,
    projection?.participant2Goals ?? null,
  );
  return (
    <main className="shell">
      <div className="eyebrow">Normalized fixture details</div>
      <h1>
        {teams.homeTeam} vs {teams.awayTeam}
      </h1>
      <span className="pill">
        {fixture.replayState?.status === "RUNNING"
          ? "Replay"
          : fixture.sourceMode === "LIVE"
            ? "Live"
            : "Synthetic"}
      </span>
      <section className="grid">
        <article className="card">
          <h2>Displayed score</h2>
          <p className="score">
            {score.homeScore ?? "–"}–{score.awayScore ?? "–"}
          </p>
          <p>Phase: {projection?.latestPhase ?? "UNKNOWN"}</p>
          <p>Explicit finalisation observed: {projection?.finalised ? "yes" : "no"}</p>
        </article>
        <article className="card">
          <h2>Provider ordering</h2>
          <p>Participant 1: {fixture.participant1Name}</p>
          <p>Participant 2: {fixture.participant2Name}</p>
          <p>Participant 1 is home: {fixture.participant1IsHome ? "yes" : "no"}</p>
        </article>
        <article className="card">
          <h2>Projection</h2>
          <p>Source mode: {projection?.sourceMode ?? fixture.sourceMode}</p>
          <p>Latest provider sequence: {projection?.latestSequence ?? "none"}</p>
        </article>
      </section>
      <section className="card observations">
        <h2>Recent normalized observations</h2>
        {fixture.scoreObservations.length ? (
          fixture.scoreObservations.map((item) => (
            <p key={item.id}>
              <strong>#{item.providerSequence}</strong> {item.phase} · {item.action} · P1{" "}
              {item.participant1Goals ?? "–"} / P2 {item.participant2Goals ?? "–"}
            </p>
          ))
        ) : (
          <p>No score observations.</p>
        )}
      </section>
    </main>
  );
}
