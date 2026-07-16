"use client";

import { calculatePosition } from "@predict9ja/domain";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";

export type JudgeDemoView = Readonly<{
  balance: number;
  fixture: Readonly<{
    homeTeam: string;
    awayTeam: string;
    finalised: boolean;
    action: string | null;
    homeScore: number | null;
    awayScore: number | null;
  }>;
  markets: readonly Readonly<{
    id: string;
    title: string;
    ruleVersion: string;
    outcomes: readonly Readonly<{
      key: string;
      label: string;
      quoteVersion: number;
      priceBasisPoints: number;
    }>[];
  }>[];
  position: Readonly<{
    market: string;
    outcome: string;
    stake: number;
    quoteVersion: number;
    priceBasisPoints: number;
    potentialPayout: number;
    actualPayout: number | null;
    winningOutcome: string | null;
    settlementStatus: string | null;
    receiptId: string | null;
    ruleVersion: string;
    integrityDigest: string | null;
  }> | null;
  ledger: readonly Readonly<{ id: string; type: string; amount: number }>[];
}>;

type Selection = {
  marketId: string;
  market: string;
  outcomeKey: string;
  outcome: string;
  quoteVersion: number;
  priceBasisPoints: number;
};

export function JudgeDemo({ demo }: Readonly<{ demo: JudgeDemoView | null }>) {
  const router = useRouter();
  const [selection, setSelection] = useState<Selection | null>(null);
  const [stake, setStake] = useState(1000);
  const [pending, setPending] = useState<"session" | "purchase" | "simulation" | null>(null);
  const [message, setMessage] = useState("");
  const quote = useMemo(
    () => (selection ? calculatePosition(stake, selection.priceBasisPoints) : null),
    [selection, stake],
  );
  const step = !demo ? 1 : !demo.position ? 2 : !demo.fixture.finalised ? 3 : 4;

  async function start() {
    setPending("session");
    setMessage("Creating an isolated judge demo…");
    try {
      const response = await fetch("/api/demo/session", { method: "POST" });
      setMessage(
        response.ok
          ? "Demo ready with exactly 10,000 fictional credits."
          : "The demo could not be started safely. Please try again.",
      );
      if (response.ok) router.refresh();
    } catch {
      setMessage("The demo could not be started safely. Please try again.");
    } finally {
      setPending(null);
    }
  }

  async function purchase() {
    if (!selection) return;
    setPending("purchase");
    setMessage("Confirming the fictional-credit prediction…");
    try {
      const response = await fetch("/api/demo/purchase", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          marketId: selection.marketId,
          outcomeKey: selection.outcomeKey,
          stakeCredits: stake,
          quoteVersion: selection.quoteVersion,
          idempotencyKey: crypto.randomUUID().replaceAll("-", ""),
        }),
      });
      const body = (await response.json().catch(() => null)) as { code?: string } | null;
      setMessage(
        response.ok
          ? "Prediction confirmed using the active quote."
          : body?.code === "INSUFFICIENT_CREDITS"
            ? "There are not enough fictional demo credits for that stake."
            : "The prediction could not be confirmed safely.",
      );
      if (response.ok) router.refresh();
    } catch {
      setMessage("The prediction could not be confirmed safely.");
    } finally {
      setPending(null);
    }
  }

  async function simulate() {
    setPending("simulation");
    setMessage("Applying the seeded synthetic match observations and settlement rules…");
    try {
      const response = await fetch("/api/demo/simulate", { method: "POST" });
      setMessage(
        response.ok
          ? "Simulation complete. The finalised result and receipt are ready."
          : "The simulation could not be completed safely.",
      );
      if (response.ok) router.refresh();
    } catch {
      setMessage("The simulation could not be completed safely.");
    } finally {
      setPending(null);
    }
  }

  return (
    <section className="demo-panel observations">
      <div className="section-label synthetic">Synthetic demo-credit market</div>
      <h2>Experience deterministic settlement</h2>
      <p>
        The synthetic market demonstrates Predict9ja’s deterministic settlement engine. It does not
        claim that the real TxLINE proof triggered a payout.
      </p>
      <ol className="stepper" aria-label="Judge demo progress">
        {["Start demo", "Make prediction", "Run simulation", "Inspect result"].map(
          (label, index) => (
            <li className={step >= index + 1 ? "active" : ""} key={label}>
              <span>{index + 1}</span>
              {label}
            </li>
          ),
        )}
      </ol>

      <article className="demo-step">
        <div>
          <span className="step-number">1</span>
          <h3>Start an isolated demo</h3>
          <p>Creates a fresh anonymous session with exactly 10,000 fictional demo credits.</p>
        </div>
        <button className="button primary" disabled={pending !== null} onClick={() => void start()}>
          {pending === "session" ? "Starting…" : demo ? "Reset demo" : "Start judge demo"}
        </button>
        {demo && <strong className="balance">{demo.balance.toLocaleString()} demo credits</strong>}
      </article>

      {demo && (
        <>
          <article className="demo-step">
            <div>
              <span className="step-number">2</span>
              <h3>Make a prediction</h3>
              <p>
                {demo.fixture.homeTeam} vs {demo.fixture.awayTeam} · fictional demo credits only
              </p>
            </div>
            <div className="judge-markets">
              {demo.markets.map((market) => (
                <div className="judge-market" key={market.id}>
                  <h4>{market.title}</h4>
                  <div className="outcomes">
                    {market.outcomes.map((outcome) => (
                      <button
                        className="outcome"
                        disabled={Boolean(demo.position) || pending !== null}
                        key={outcome.key}
                        onClick={() =>
                          setSelection({
                            marketId: market.id,
                            market: market.title,
                            outcomeKey: outcome.key,
                            outcome: outcome.label,
                            quoteVersion: outcome.quoteVersion,
                            priceBasisPoints: outcome.priceBasisPoints,
                          })
                        }
                      >
                        <strong>{outcome.label}</strong>
                        <small>{(outcome.priceBasisPoints / 100).toFixed(2)}% demo quote</small>
                      </button>
                    ))}
                  </div>
                </div>
              ))}
            </div>
            {selection && !demo.position && quote && (
              <div className="quote-card">
                <strong>
                  {selection.market}: {selection.outcome}
                </strong>
                <div className="stake-presets">
                  {[500, 1000, 2000].map((amount) => (
                    <button
                      className={stake === amount ? "selected" : ""}
                      key={amount}
                      onClick={() => setStake(amount)}
                    >
                      {amount.toLocaleString()}
                    </button>
                  ))}
                </div>
                <dl>
                  <dt>Active quote</dt>
                  <dd>{(selection.priceBasisPoints / 100).toFixed(2)}%</dd>
                  <dt>Stake</dt>
                  <dd>{stake.toLocaleString()} demo credits</dd>
                  <dt>Potential payout</dt>
                  <dd>{quote.potentialPayoutCredits.toLocaleString()} demo credits</dd>
                  <dt>Quote version</dt>
                  <dd>{selection.quoteVersion}</dd>
                </dl>
                <button
                  className="button primary"
                  disabled={pending !== null}
                  onClick={() => void purchase()}
                >
                  {pending === "purchase" ? "Confirming…" : "Confirm prediction"}
                </button>
              </div>
            )}
          </article>

          <article className="demo-step">
            <div>
              <span className="step-number">3</span>
              <h3>Run deterministic match simulation</h3>
              <p>
                Applies the six seeded observations through game_finalised, then resolves and
                settles once.
              </p>
            </div>
            <button
              className="button primary"
              disabled={!demo.position || demo.fixture.finalised || pending !== null}
              onClick={() => void simulate()}
            >
              {pending === "simulation"
                ? "Running…"
                : demo.fixture.finalised
                  ? "Simulation complete"
                  : "Run match simulation"}
            </button>
          </article>

          {demo.position && demo.fixture.finalised && (
            <article className="result-card">
              <div className="section-label receipt">Application settlement receipt</div>
              <h3>
                {demo.fixture.homeTeam} {demo.fixture.homeScore}–{demo.fixture.awayScore}{" "}
                {demo.fixture.awayTeam}
              </h3>
              <p>
                <strong>{demo.fixture.action}</strong> · winning outcome{" "}
                {demo.position.winningOutcome}
              </p>
              <dl>
                <dt>Selected market</dt>
                <dd>{demo.position.market}</dd>
                <dt>Selected outcome</dt>
                <dd>{demo.position.outcome}</dd>
                <dt>Stake</dt>
                <dd>{demo.position.stake.toLocaleString()} demo credits</dd>
                <dt>Quote</dt>
                <dd>
                  v{demo.position.quoteVersion} ·{" "}
                  {(demo.position.priceBasisPoints / 100).toFixed(2)}%
                </dd>
                <dt>Potential payout</dt>
                <dd>{demo.position.potentialPayout.toLocaleString()} demo credits</dd>
                <dt>Actual payout</dt>
                <dd>{(demo.position.actualPayout ?? 0).toLocaleString()} demo credits</dd>
                <dt>Settlement</dt>
                <dd>{demo.position.settlementStatus?.toLowerCase()}</dd>
                <dt>Final balance</dt>
                <dd>{demo.balance.toLocaleString()} demo credits</dd>
                <dt>Rule version</dt>
                <dd>{demo.position.ruleVersion}</dd>
                <dt>Integrity digest</dt>
                <dd className="digest">{demo.position.integrityDigest}</dd>
              </dl>
              <h4>Position ledger</h4>
              {demo.ledger.map((entry) => (
                <p className="ledger-row" key={entry.id}>
                  <span>{entry.type.replaceAll("_", " ").toLowerCase()}</span>
                  <strong>
                    {entry.amount > 0 ? "+" : ""}
                    {entry.amount.toLocaleString()}
                  </strong>
                </p>
              ))}
              {demo.position.receiptId && (
                <Link
                  className="button primary inline-button"
                  href={`/proofs/${demo.position.receiptId}`}
                >
                  Inspect receipt
                </Link>
              )}
            </article>
          )}
        </>
      )}
      <p role="status" aria-live="polite">
        {message}
      </p>
    </section>
  );
}
