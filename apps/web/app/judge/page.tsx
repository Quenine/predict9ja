import { loadJudgePage } from "../page-loaders";
import { judgeEvidenceState, selectJudgeProof } from "./evidence";
import { JudgeDemo, type JudgeDemoView } from "./judge-demo";
import type { Metadata } from "next";
import Link from "next/link";

export const dynamic = "force-dynamic";
export const metadata: Metadata = {
  title: "Replay & Predict",
  description:
    "Make a fictional prediction, replay real TxLINE observations, settle deterministically and inspect verified source evidence.",
};
export default async function Judge({
  searchParams,
}: {
  searchParams: Promise<{ mode?: string }>;
}) {
  const requestedMode = (await searchParams).mode === "synthetic" ? "SYNTHETIC" : "REPLAY";
  const result = await loadJudgePage();
  if (result.state !== "loaded")
    return (
      <main className="shell">
        <h1>Judge evidence unavailable</h1>
        <section className="card">
          <p>Evidence data could not be loaded.</p>
        </section>
      </main>
    );
  const { fixture, verifiedFinal, fallback, demo } = result.data;
  const proof = selectJudgeProof(verifiedFinal, fallback);
  const evidence = judgeEvidenceState(proof);
  const statKeys = Array.isArray(proof?.statKeys) ? proof.statKeys.join(", ") : "not available";
  const statValues = Array.isArray(proof?.statValues)
    ? proof.statValues.join(", ")
    : "not available";
  const score = proof?.scoreObservation
    ? `${proof.scoreObservation.participant1Goals ?? "–"}–${
        proof.scoreObservation.participant2Goals ?? "–"
      }`
    : "not available";
  const demoPosition = demo?.account.positions[0] ?? null;
  const demoPurchase = demo?.account.purchases.find(
    (purchase) =>
      purchase.marketId === demoPosition?.marketId && purchase.outcomeId === demoPosition.outcomeId,
  );
  const demoProjection = demo?.fixture.scoreProjection;
  const demoView: JudgeDemoView | null = demo
    ? {
        balance: demo.account.availableCredits,
        mode: demo.mode,
        canonicalSourceId: demo.canonicalSourceId,
        fixture: {
          homeTeam: demo.fixture.homeTeam,
          awayTeam: demo.fixture.awayTeam,
          finalised: demoProjection?.finalised ?? false,
          action: demoProjection?.latestAction ?? null,
          homeScore: demoProjection
            ? demo.fixture.participant1IsHome
              ? demoProjection.participant1Goals
              : demoProjection.participant2Goals
            : null,
          awayScore: demoProjection
            ? demo.fixture.participant1IsHome
              ? demoProjection.participant2Goals
              : demoProjection.participant1Goals
            : null,
        },
        markets: demo.fixture.markets.map((market) => ({
          id: market.id,
          title: market.title,
          ruleVersion: market.ruleVersion,
          outcomes: market.outcomes.flatMap((outcome) => {
            const quote = outcome.quotes[0];
            return quote
              ? [
                  {
                    key: outcome.key,
                    label: outcome.label,
                    quoteVersion: quote.version,
                    priceBasisPoints: quote.priceBasisPoints,
                  },
                ]
              : [];
          }),
        })),
        position: demoPosition
          ? {
              market: demoPosition.market.title,
              outcome: demoPosition.outcome.label,
              stake: demoPosition.stakeCredits,
              quoteVersion: demoPurchase?.quoteVersion ?? 0,
              priceBasisPoints: demoPurchase?.priceBasisPoints ?? 0,
              potentialPayout: demoPosition.potentialPayoutCredits,
              actualPayout: demoPosition.actualPayoutCredits,
              winningOutcome: demoPosition.market.receipt?.winningOutcomeKey ?? null,
              settlementStatus: demoPosition.market.receipt?.settlementStatus ?? null,
              receiptId: demoPosition.market.receipt?.id ?? null,
              ruleVersion: demoPosition.market.ruleVersion,
              integrityDigest: demoPosition.market.receipt?.integrityDigest ?? null,
            }
          : null,
        ledger: demo.account.ledgerEntries.map((entry) => ({
          id: entry.id,
          type: entry.entryType,
          amount: entry.amount,
        })),
        timeline: demo.fixture.scoreObservations.map((observation) => ({
          sequence: observation.providerSequence,
          action: observation.action,
          phase: observation.phase,
          participant1Goals: observation.participant1Goals,
          participant2Goals: observation.participant2Goals,
          finalised: observation.finalised,
        })),
      }
    : null;

  return (
    <main className="shell">
      <div className="eyebrow">Replay & Predict</div>
      <h1>Make your pick, then replay a real TxLINE match.</h1>
      <p className="lead">
        Start with demo credits, choose an outcome and replay England vs Argentina through its
        stored TxLINE updates. Predict9ja settles the result using clear, deterministic rules.
      </p>
      <ol className="judge-path" aria-label="Verified replay path">
        <li>Get demo credits</li>
        <li>Make your pick</li>
        <li>Replay the match</li>
        <li>See your result</li>
      </ol>
      <Link className="button primary inline-button" href="#interactive-replay">
        Start Replay & Predict
      </Link>

      <details className="evidence-card observations" id="verified-evidence">
        <summary>Technical proof details</summary>
        <div className="section-label real">Real TxLINE + Solana evidence</div>
        <h2>{fixture ? `${fixture.homeTeam} vs ${fixture.awayTeam}` : "England vs Argentina"}</h2>
        <p className="evidence-score">{score}</p>
        <p>
          <strong>{evidence.wording}</strong>
        </p>
        <div className="evidence-pipeline" aria-label="Evidence verification pipeline">
          {[
            "TxLINE fixture",
            "normalized observation",
            "proof predicates",
            "Solana validation",
            "verified evidence",
          ].map((label, index) => (
            <div key={label}>
              <span>{label}</span>
              {index < 4 && <b aria-hidden="true">→</b>}
            </div>
          ))}
        </div>
        <dl>
          <dt>Provider sequence</dt>
          <dd>{proof?.providerSequence ?? "not available"}</dd>
          <dt>Observation</dt>
          <dd>{proof?.scoreObservation?.action ?? "not available"}</dd>
          <dt>Stat keys</dt>
          <dd>{statKeys}</dd>
          <dt>Verified values</dt>
          <dd>{statValues}</dd>
          <dt>Proof digest</dt>
          <dd className="digest">{proof?.proofPayloadDigest ?? "not available"}</dd>
          <dt>Solana network</dt>
          <dd>{proof?.network ?? "not available"}</dd>
          <dt>TxLINE program ID</dt>
          <dd className="digest">{proof?.programId ?? "not available"}</dd>
          <dt>Daily scores PDA</dt>
          <dd className="digest">{proof?.dailyScoresPda ?? "not available"}</dd>
          <dt>Read-only validation status</dt>
          <dd>{proof?.validationStatus ?? "not requested"}</dd>
        </dl>
        {evidence.state === "FINAL_MATCH" && (
          <p className="integrity-note">
            No real-market settlement receipt is linked to this proof.
          </p>
        )}
      </details>
      <section className="mode-comparison observations">
        <article>
          <strong>Real replay demonstrates</strong>
          <p>
            Actual TxLINE match, stored updates, verified match replay, rules-based settlement and
            verified source evidence.
          </p>
        </article>
        <article>
          <strong>Synthetic demo demonstrates</strong>
          <p>
            An instant provider-independent lifecycle using a fictional fixture and fictional
            credits.
          </p>
        </article>
      </section>
      <JudgeDemo demo={demoView} initialMode={requestedMode} />
    </main>
  );
}
