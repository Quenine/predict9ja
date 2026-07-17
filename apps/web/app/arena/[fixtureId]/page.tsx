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
import {
  hasDisplayScore,
  observationPresentation,
  providerPhasePresentation,
} from "../../presentation";

export const dynamic = "force-dynamic";
export const metadata: Metadata = {
  title: "Match overview",
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
        <h1>Match unavailable</h1>
        <section className="card">
          <p>Match data could not be loaded safely.</p>
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
  const hasScore = hasDisplayScore(projection?.participant1Goals, projection?.participant2Goals);
  const fanObservations = fixture.scoreObservations.filter((item) => item.providerSequence <= 962);
  return (
    <main className="shell fixture-detail">
      <Link className="back-link" href="/arena">
        ← Back to matches
      </Link>
      <div className="eyebrow">Match overview</div>
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
          <h2>Match status</h2>
          <strong>
            {hasScore ? fixtureDisplayState(fixture.status, projection) : "Awaiting kickoff"}
          </strong>
          {hasScore && (
            <p className="score">
              {score.homeScore ?? "–"}–{score.awayScore ?? "–"}
            </p>
          )}
        </div>
        <div>
          <h2>
            {fixture.status === "SCHEDULED"
              ? "Match availability"
              : replayAvailable
                ? "Replay this match"
                : "Result verification"}
          </h2>
          <strong>
            {fixture.status === "SCHEDULED"
              ? "Tracking starts at kickoff"
              : fixtureMarketState(fixture)}
          </strong>
          {fixture.status === "SCHEDULED" ? (
            <>
              <p>TxLINE match updates will appear here when they become available.</p>
              <p>Predictions are not open for this match.</p>
              <p className="meta">Final-score verification is checked after full time.</p>
            </>
          ) : (
            <p>
              {replayAvailable
                ? "This result can be replayed using the real TxLINE updates stored by Predict9ja."
                : "Prediction availability is shown honestly from the current application state."}
            </p>
          )}
          {replayAvailable && (
            <Link className="button primary inline-button" href="/judge?mode=replay">
              Replay this match
            </Link>
          )}
        </div>
      </section>

      <section className="card observations">
        <h2>Match timeline</h2>
        {fanObservations.length ? (
          <div className="fan-timeline">
            {fanObservations.map((item) => {
              const event = observationPresentation({
                homeTeam: teams.homeTeam,
                awayTeam: teams.awayTeam,
                participant1IsHome: fixture.participant1IsHome,
                participant1Goals: item.participant1Goals,
                participant2Goals: item.participant2Goals,
                phase: item.phase,
                action: item.action,
                finalised: item.finalised,
                authoritative: item.providerSequence === 962,
                sequence: item.providerSequence,
              });
              return (
                <article
                  className={item.providerSequence === 962 ? "authoritative-observation" : ""}
                  key={item.id}
                >
                  <strong>{event.fanLabel}</strong>
                  <span>{event.score}</span>
                  {event.authorityLabel && <small>{event.authorityLabel}</small>}
                </article>
              );
            })}
          </div>
        ) : (
          <p>
            {fixture.status === "SCHEDULED"
              ? "Match updates will appear here when TxLINE data becomes available."
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
            <dt>Provider phase</dt>
            <dd>
              {providerPhasePresentation(projection?.latestPhase)}
              <br />
              <small>Raw value: {projection?.latestPhase ?? "UNKNOWN"}</small>
            </dd>
          </dl>
          <h2>All stored observations</h2>
          {fixture.scoreObservations.map((item) => {
            const event = observationPresentation({
              homeTeam: teams.homeTeam,
              awayTeam: teams.awayTeam,
              participant1IsHome: fixture.participant1IsHome,
              participant1Goals: item.participant1Goals,
              participant2Goals: item.participant2Goals,
              phase: item.phase,
              action: item.action,
              finalised: item.finalised,
              authoritative: item.providerSequence === 962,
              sequence: item.providerSequence,
            });
            return (
              <article
                className={item.providerSequence === 962 ? "authoritative-observation" : ""}
                key={item.id}
              >
                <strong>
                  {event.title} · sequence {item.providerSequence}
                </strong>
                <p>{event.technicalSummary}</p>
                <code className="digest">
                  phase={item.phase} · action={item.action} · participant1Goals=
                  {item.participant1Goals ?? "null"} · participant2Goals=
                  {item.participant2Goals ?? "null"}
                </code>
                {item.providerSequence === 962 && <p>authoritative final evidence</p>}
                {item.providerSequence === 963 && <p>later non-authoritative observation</p>}
              </article>
            );
          })}
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
