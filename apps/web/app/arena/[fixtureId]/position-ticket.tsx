"use client";
import { calculatePosition } from "@predict9ja/domain";
import { useMemo, useState } from "react";
type Selection = Readonly<{
  marketId: string;
  outcomeKey: string;
  label: string;
  priceBasisPoints: number;
  quoteVersion: number;
}>;
export function PositionTicket({
  selection,
  balance,
}: Readonly<{ selection: Selection; balance: number }>) {
  const [stake, setStake] = useState(100);
  const [message, setMessage] = useState("");
  const quote = useMemo(
    () => calculatePosition(stake, selection.priceBasisPoints),
    [stake, selection.priceBasisPoints],
  );
  async function confirm() {
    setMessage("Submitting…");
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
    const result = (await response.json()) as { code?: string };
    setMessage(
      response.ok
        ? "Position purchased successfully."
        : result.code === "SESSION_REQUIRED"
          ? "Start an isolated demo session first."
          : result.code === "INSUFFICIENT_CREDITS"
            ? "Insufficient demo credits."
            : result.code === "STALE_QUOTE"
              ? "The quote changed. Refresh and confirm again."
              : result.code === "MARKET_CLOSED"
                ? "This market is closed."
                : "The purchase could not be completed.",
    );
  }
  return (
    <section className="card ticket">
      <h2>Position ticket</h2>
      <p>
        {selection.label} · {(selection.priceBasisPoints / 100).toFixed(2)}% synthetic demo
        probability
      </p>
      <label>
        Integer stake
        <input
          type="number"
          min={1}
          max={5000}
          value={stake}
          onChange={(event) => setStake(Math.max(1, Number(event.target.value)))}
        />
      </label>
      <p>Shares: {(quote.sharesMicros / 1_000_000).toFixed(6)}</p>
      <p>Potential whole-credit payout: {quote.potentialPayoutCredits}</p>
      <p>Remaining balance: {Math.max(0, balance - stake)} demo credits</p>
      <button className="button primary" onClick={() => void confirm()}>
        Confirm demo position
      </button>
      <p role="status">{message}</p>
    </section>
  );
}
