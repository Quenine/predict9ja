import { db } from "@predict9ja/db";
import Link from "next/link";
import { StartSession } from "./start-session";
export const dynamic = "force-dynamic";
export default async function Judge() {
  const [fixture, proof] = await Promise.all([
    db.fixture.findUnique({
      where: { sourceId: "18241006" },
      include: {
        scoreObservations: {
          where: { sourceMode: "LIVE" },
          orderBy: { providerSequence: "desc" },
          take: 1,
        },
      },
    }),
    db.scoreProofVerification.findFirst({
      where: { fixtureSourceId: "18241006" },
      orderBy: { updatedAt: "desc" },
    }),
  ]);
  return (
    <main className="shell">
      <div className="eyebrow">Judge walkthrough</div>
      <h1>Demo-credit judge walkthrough</h1>
      <StartSession />
      <section className="grid">
        <article className="card">
          <h2>1–3. Session and position</h2>
          <p>
            Use the fictional fixture and isolated demo credits for the settlement demonstration.
          </p>
          <Link href="/arena/synthetic-kora-savanna-001">Open synthetic fixture</Link>
        </article>
        <article className="card">
          <h2>4–6. Replay and resolve</h2>
          <p>
            <code>pnpm demo:run</code> resolves only after explicit synthetic{" "}
            <code>game_finalised</code>.
          </p>
        </article>
        <article className="card">
          <h2>7–8. Inspect</h2>
          <p>Inspect the ledger-backed demo payout and its separate application receipt.</p>
          <Link href="/portfolio">Open portfolio</Link>
        </article>
      </section>
      <section className="card observations">
        <h2>Proof Verification</h2>
        <ol>
          <li>Real TxLINE fixture synchronized: {fixture ? "yes" : "not yet"}</li>
          <li>
            Real score sequence observed:{" "}
            {fixture?.scoreObservations[0]?.providerSequence ?? "not yet"}
          </li>
          <li>Ordered stat keys requested: 1, 2</li>
          <li>
            Merkle proof fetched:{" "}
            {proof?.fetchStatus === "FETCHED" ? "yes" : (proof?.fetchStatus ?? "not requested")}
          </li>
          <li>Proof normalized and digested: {proof?.proofPayloadDigest ? "yes" : "not yet"}</li>
          <li>
            Matching devnet program and daily-root PDA selected:{" "}
            {proof?.dailyScoresPda ? "yes" : "not yet"}
          </li>
          <li>
            <code>validateStatV2</code> executed through read-only view:{" "}
            {proof && proof.validationStatus !== "NOT_REQUESTED" ? "yes" : "not yet"}
          </li>
          <li>Result: {proof?.validationStatus ?? "not requested"}</li>
        </ol>
        <p>
          <strong>
            {proof?.validationStatus === "VERIFIED" &&
            proof.observationClassification === "FINAL_MATCH_OBSERVATION"
              ? "Final match observation verified"
              : "Verified observation — not final settlement evidence"}
          </strong>
        </p>
        {proof?.validationStatus === "VERIFIED" &&
          proof.settlementEvidenceClassification === "FINAL_DATA_VERIFIED_NO_RECEIPT" && (
            <p>No matching market settlement receipt is linked to this proof.</p>
          )}
        <p>
          The synthetic settlement demonstration is separate. Future production real-value
          settlement is not implemented.
        </p>
      </section>
    </main>
  );
}
