"use client";
import { useState } from "react";
import { PositionTicket } from "./position-ticket";
type Market = Readonly<{
  id: string;
  title: string;
  status: string;
  closeAt: string;
  outcomes: readonly Readonly<{
    key: string;
    label: string;
    quote: Readonly<{ version: number; priceBasisPoints: number; source: string }> | null;
  }>[];
}>;
export function MarketBoard({
  markets,
  balance,
}: Readonly<{ markets: readonly Market[]; balance: number }>) {
  const [selected, setSelected] = useState<{
    marketId: string;
    outcomeKey: string;
    label: string;
    quoteVersion: number;
    priceBasisPoints: number;
  } | null>(null);
  return (
    <>
      <section className="market-list">
        {markets.map((market) => (
          <article className="card" key={market.id}>
            <h2>{market.title}</h2>
            <p>
              {market.status} · closes {new Date(market.closeAt).toLocaleString("en-NG")}
            </p>
            <div className="outcomes">
              {market.outcomes.map(
                (outcome) =>
                  outcome.quote && (
                    <button
                      className="outcome"
                      key={outcome.key}
                      onClick={() =>
                        setSelected({
                          marketId: market.id,
                          outcomeKey: outcome.key,
                          label: outcome.label,
                          quoteVersion: outcome.quote!.version,
                          priceBasisPoints: outcome.quote!.priceBasisPoints,
                        })
                      }
                    >
                      <strong>{outcome.label}</strong>
                      <span>{(outcome.quote.priceBasisPoints / 100).toFixed(2)}%</span>
                      <small>{outcome.quote.source.replaceAll("_", " ")} demo quote</small>
                    </button>
                  ),
              )}
            </div>
          </article>
        ))}
      </section>
      {selected && <PositionTicket selection={selected} balance={balance} />}
    </>
  );
}
