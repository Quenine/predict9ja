import { db } from "@predict9ja/db";
import Link from "next/link";
import { judgeEvidenceState, selectJudgeProof } from "./evidence";
import { StartSession } from "./start-session";

export const dynamic = "force-dynamic";
const fixtureSourceId = "18241006";

export default async function Judge() {
  const include = { scoreObservation: true, receipt: true } as const;
  const [fixture, verifiedFinal, fallback] = await Promise.all([
    db.fixture.findUnique({ where: { sourceId: fixtureSourceId } }),
    db.scoreProofVerification.findFirst({
      where: {
        fixtureSourceId,
        validationStatus: "VERIFIED",
        observationClassification: "FINAL_MATCH_OBSERVATION",
        scoreObservation: {
          sourceMode: "LIVE",
          action: "game_finalised",
          finalised: true,
        },
      },
      include,
      orderBy: { verifiedAt: "desc" },
    }),
    db.scoreProofVerification.findFirst({
      where: { fixtureSourceId },
      include,
      orderBy: { updatedAt: "desc" },
    }),
  ]);
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

  return (
    <main className="shell">
      <div className="eyebrow">Judge walkthrough</div>
      <h1>Predict9ja evidence and demo flow</h1>

      <section className="card observations">
        <h2>Real TxLINE data and Solana proof verification</h2>
        <p>
          <strong>{evidence.wording}</strong>
        </p>
        <dl>
          <dt>Real TxLINE fixture</dt>
          <dd>{fixture?.sourceId ?? "not available"}</dd>
          <dt>Final score</dt>
          <dd>{score}</dd>
          <dt>Final provider sequence</dt>
          <dd>{proof?.providerSequence ?? "not available"}</dd>
          <dt>Source action</dt>
          <dd>{proof?.scoreObservation?.action ?? "not available"}</dd>
          <dt>TxLINE proof payload digest</dt>
          <dd className="digest">{proof?.proofPayloadDigest ?? "not available"}</dd>
          <dt>Ordered stat keys</dt>
          <dd>{statKeys}</dd>
          <dt>Verified stat values</dt>
          <dd>{statValues}</dd>
          <dt>Solana network</dt>
          <dd>{proof?.network ?? "not available"}</dd>
          <dt>TxLINE program ID</dt>
          <dd className="digest">{proof?.programId ?? "not available"}</dd>
          <dt>Daily scores PDA</dt>
          <dd className="digest">{proof?.dailyScoresPda ?? "not available"}</dd>
          <dt>Read-only validation</dt>
          <dd>{proof?.validationStatus ?? "not requested"}</dd>
          <dt>Evidence classification</dt>
          <dd>{evidence.wording}</dd>
          <dt>Verified timestamp</dt>
          <dd>{proof?.verifiedAt?.toISOString() ?? "not available"}</dd>
        </dl>
        {evidence.state === "FINAL_MATCH" && (
          <p>No matching real-market settlement receipt is linked to this proof.</p>
        )}
      </section>

      <section className="observations">
        <h2>Synthetic demo-credit prediction and settlement</h2>
        <p>
          This isolated demonstration uses fictional credits and does not imply that the real TxLINE
          proof triggered a payout.
        </p>
        <StartSession />
        <div className="grid">
          <article className="card">
            <h3>1. Open a demo position</h3>
            <p>Use the fictional fixture and isolated demo credits.</p>
            <Link href="/arena/synthetic-kora-savanna-001">Open synthetic fixture</Link>
          </article>
          <article className="card">
            <h3>2. Replay and resolve</h3>
            <p>
              <code>pnpm demo:run</code> resolves only after synthetic <code>game_finalised</code>.
            </p>
          </article>
          <article className="card">
            <h3>3. Inspect the receipt</h3>
            <p>Review the demo-credit ledger and separate application receipt.</p>
            <Link href="/portfolio">Open portfolio</Link>
          </article>
        </div>
      </section>
    </main>
  );
}
