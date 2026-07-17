import { displayedScore, displayedTeams } from "@predict9ja/domain";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { fixtureDisplayState } from "../fixture-display-state";
import {
  fixtureLifecycleLabel,
  fixtureMarketState,
  fixtureProofState,
  fixtureReplayReady,
  formatCatalogueDate,
} from "../catalogue";
import { loadFixturePage } from "../../page-loaders";
import { MarketBoard } from "./market-board";

export const dynamic = "force-dynamic";
export const metadata: Metadata = {
  title: "Match data",
  description:
    "Fan-readable TxLINE fixture data, score progression and verifiable source evidence.",
};

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
          <p>Fixture data could not be loaded safely.</p>
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
  const replayAvailable = fixtureReplayReady(fixture);
  const fanObservations = fixture.scoreObservations.filter((item) => item.providerSequence <= 962);
  return (
    <main className="shell fixture-detail">
      <Link className="back-link" href="/arena">
        ← Back to fixtures
      </Link>
      <div className="eyebrow">TxLINE match data</div>
      <h1>
        {teams.homeTeam} vs {teams.awayTeam}
      </h1>
      <p className="lead">{formatCatalogueDate(fixture.startsAt)}</p>
      <div className="fixture-badges">
        <span className="pill">{fixtureLifecycleLabel(fixture)}</span>
        <span className="pill">{fixtureProofState(fixture)}</span>
        {replayAvailable && <span className="pill">Replay available</span>}
      </div>
      <section className="match-hero card">
        <div>
          <span className="meta">{fixtureDisplayState(fixture.status, projection)}</span>
          <p className="score">
            {score.homeScore ?? "–"}–{score.awayScore ?? "–"}
          </p>
        </div>
        <div>
          <strong>{fixtureMarketState(fixture)}</strong>
          <p>
            {replayAvailable
              ? "This final match can be replayed using fictional credits in an isolated demo session."
              : fixture.status === "SCHEDULED"
                ? "This upcoming fixture is data only and does not currently have application markets."
                : "Prediction availability is shown honestly from the current application state."}
          </p>
          {replayAvailable && (
            <Link className="button primary inline-button" href="/judge?mode=replay">
              Run verified replay
            </Link>
          )}
        </div>
      </section>

      <section className="card observations">
        <h2>Match timeline</h2>
        {fanObservations.length ? (
          <div className="fan-timeline">
            {fanObservations.map((item) => {
              const eventScore = displayedScore(
                fixture.participant1IsHome,
                item.participant1Goals,
                item.participant2Goals,
              );
              return (
                <article
                  className={item.providerSequence === 962 ? "authoritative-observation" : ""}
                  key={item.id}
                >
                  <strong>
                    {item.action === "game_finalised"
                      ? "Full time"
                      : item.phase === "UNKNOWN"
                        ? "Match update"
                        : item.phase.replaceAll("_", " ").toLowerCase()}
                  </strong>
                  <span>
                    {teams.homeTeam} {eventScore.homeScore ?? "–"}–{eventScore.awayScore ?? "–"}{" "}
                    {teams.awayTeam}
                  </span>
                  {item.providerSequence === 962 && <small>Authoritative final observation</small>}
                </article>
              );
            })}
          </div>
        ) : (
          <p>
            {fixture.status === "SCHEDULED"
              ? `Kickoff is scheduled for ${formatCatalogueDate(fixture.startsAt)}. Match observations will appear when TxLINE exposes them.`
              : "No fan-facing score observations are currently available."}
          </p>
        )}
      </section>

      <details className="technical-disclosure">
        <summary>Technical source details</summary>
        <div className="card">
          <dl>
            <dt>Source mode</dt>
            <dd>{fixture.sourceMode}</dd>
            <dt>TxLINE fixture ID</dt>
            <dd>{fixture.sourceId}</dd>
            <dt>Participant 1</dt>
            <dd>{fixture.participant1Name}</dd>
            <dt>Participant 2</dt>
            <dd>{fixture.participant2Name}</dd>
            <dt>Participant 1 is home</dt>
            <dd>{fixture.participant1IsHome ? "yes" : "no"}</dd>
            <dt>Raw provider phase</dt>
            <dd>{projection?.latestPhase ?? "UNKNOWN"}</dd>
          </dl>
          <h2>All stored observations</h2>
          {fixture.scoreObservations.map((item) => (
            <p
              className={item.providerSequence === 962 ? "authoritative-observation" : ""}
              key={item.id}
            >
              <strong>Sequence {item.providerSequence}</strong> · {item.phase} · {item.action} · P1{" "}
              {item.participant1Goals ?? "–"} / P2 {item.participant2Goals ?? "–"}
              {item.providerSequence === 962 && " · authoritative final evidence"}
              {item.providerSequence === 963 && " · later non-authoritative observation"}
            </p>
          ))}
        </div>
      </details>

      {fixture.sourceMode !== "LIVE" && (
        <>
          <section className="section-heading">
            <h2>Fictional demo markets</h2>
            <p>
              All displayed probabilities are application demonstration quotes, not TxLINE odds.
            </p>
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
    </main>
  );
}
