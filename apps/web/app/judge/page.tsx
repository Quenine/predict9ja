import Link from "next/link";
import { StartSession } from "./start-session";
export default function Judge() {
  return (
    <main className="shell">
      <div className="eyebrow">Judge walkthrough</div>
      <h1>Demo-credit judge walkthrough</h1>
      <StartSession />
      <section className="grid">
        <article className="card">
          <h2>1–3. Session and position</h2>
          <p>
            Run <code>pnpm demo:reset</code>, create an isolated 10,000-credit session, open the
            fictional fixture, select a quoted outcome, and confirm a demo position.
          </p>
          <Link href="/arena/synthetic-kora-savanna-001">Open synthetic fixture</Link>
        </article>
        <article className="card">
          <h2>4–6. Replay and resolve</h2>
          <p>
            Run <code>pnpm demo:run</code> to replay six stored observations and resolve only after
            explicit <code>game_finalised</code>.
          </p>
        </article>
        <article className="card">
          <h2>7–8. Inspect</h2>
          <p>
            Inspect the ledger-backed payout in Portfolio and open its application receipt. Live
            TxLINE requires credentials. TxLINE proofs and Solana validation are not implemented.
          </p>
          <Link href="/portfolio">Open portfolio</Link>
        </article>
      </section>
    </main>
  );
}
