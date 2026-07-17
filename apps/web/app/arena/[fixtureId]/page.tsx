import { displayedScore, displayedTeams } from "@predict9ja/domain";
import Link from "next/link";
import { notFound } from "next/navigation";
import { loadFixturePage } from "../../page-loaders";
import { MarketBoard } from "./market-board";

export const dynamic = "force-dynamic";
export default async function FixtureDetails({
  params,
}: {
  params: Promise<{ fixtureId: string }>;
}) {
  const { fixtureId } = await params;
  const result = await loadFixturePage(decodeURIComponent(fixtureId));
  if (result.state === "not_found") notFound();
  if (result.state !== "loaded")
    return (
      <main className="shell">
        <h1>Fixture unavailable</h1>
        <section className="card">
          <p>Fixture data could not be loaded.</p>
        </section>
      </main>
    );
  const { fixture: loadedFixture, account } = result.data;
  const fixture = loadedFixture!;
  const teams = displayedTeams(fixture);
  const projection = fixture.scoreProjection;
  const score = displayedScore(
    fixture.participant1IsHome,
    projection?.participant1Goals ?? null,
    projection?.participant2Goals ?? null,
  );
  const verified = fixture.proofVerifications.find(
    (proof) => proof.validationStatus === "VERIFIED" && proof.providerSequence === 962,
  );
  const replayAvailable =
    fixture.sourceMode === "LIVE" &&
    Boolean(verified) &&
    fixture.scoreObservations.some(
      (observation) =>
        observation.providerSequence === 962 &&
        observation.finalised &&
        observation.action === "game_finalised",
    );
  return (
    <main className="shell">
      <div className="eyebrow">Normalized fixture details</div>
      <h1>
        {teams.homeTeam} vs {teams.awayTeam}
      </h1>
      <span className="pill">
        {fixture.sourceMode === "REPLAY"
          ? "Historical replay"
          : fixture.sourceMode === "LIVE"
            ? "TxLINE"
            : "Synthetic"}
      </span>
      <section className="grid">
        <article className="card">
          <h2>Fixture state</h2>
          <p className="score">
            {score.homeScore ?? "–"}–{score.awayScore ?? "–"}
          </p>
          <p>Status: {fixture.status.toLowerCase()}</p>
          <p>Phase: {projection?.latestPhase ?? "UNKNOWN"}</p>
          <p>Explicit finalisation: {projection?.finalised ? "yes" : "no"}</p>
        </article>
        <article className="card">
          <h2>Provider identity</h2>
          <p>Fixture ID: {fixture.sourceId}</p>
          <p>Participant 1: {fixture.participant1Name}</p>
          <p>Participant 2: {fixture.participant2Name}</p>
          <p>Participant 1 is home: {fixture.participant1IsHome ? "yes" : "no"}</p>
        </article>
        <article className="card">
          <h2>Proof status</h2>
          <p>
            {verified
              ? "Verified"
              : fixture.proofVerifications.some((proof) => proof.fetchStatus === "FETCHED")
                ? "Proof fetched"
                : "No proof yet"}
          </p>
          {verified && (
            <>
              <p>Provider sequence: 962</p>
              <p>Final match observation verified</p>
            </>
          )}
        </article>
      </section>
      {fixture.sourceMode === "LIVE" && (
        <section className="card observations">
          <h2>Replay and market availability</h2>
          <p>
            {replayAvailable
              ? "A safe isolated historical replay is available. Predictions occur only inside that fictional-credit replay environment."
              : "No safe browser replay is currently available for this fixture."}
          </p>
          {replayAvailable && (
            <Link className="button primary inline-button" href="/judge?mode=replay">
              Run verified replay
            </Link>
          )}
        </section>
      )}
      {fixture.sourceMode !== "LIVE" && (
        <>
          <section className="section-heading">
            <h2>Prediction markets</h2>
            <p>All displayed probabilities are demonstration quotes, not TxLINE odds.</p>
          </section>
          <MarketBoard
            balance={account?.availableCredits ?? 0}
            markets={fixture.markets.map((market) => ({
              id: market.id,
              title: market.title,
              status: market.status,
              closeAt: market.closeAt.toISOString(),
              outcomes: market.outcomes.map((outcome) => ({
                key: outcome.key,
                label: outcome.label,
                quote: outcome.quotes[0]
                  ? {
                      version: outcome.quotes[0].version,
                      priceBasisPoints: outcome.quotes[0].priceBasisPoints,
                      source: outcome.quotes[0].source,
                    }
                  : null,
              })),
            }))}
          />
        </>
      )}
      <section className="card observations">
        <h2>Stored score progression</h2>
        {fixture.scoreObservations.length ? (
          fixture.scoreObservations.map((item) => (
            <p
              className={item.providerSequence === 962 ? "authoritative-observation" : ""}
              key={item.id}
            >
              <strong>#{item.providerSequence}</strong> {item.phase} · {item.action} · P1{" "}
              {item.participant1Goals ?? "–"} / P2 {item.participant2Goals ?? "–"}
              {item.providerSequence === 962 && " · authoritative final observation"}
              {item.providerSequence > 962 && " · later non-authoritative observation"}
            </p>
          ))
        ) : (
          <p>No score observations.</p>
        )}
      </section>
    </main>
  );
}
