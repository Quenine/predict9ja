import { PrismaClient } from "@prisma/client";

const url = process.env.DATABASE_URL;
if (!url || !new URL(url).pathname.toLowerCase().includes("test"))
  throw new Error("Runtime smoke preparation requires an isolated test database");
const db = new PrismaClient();
try {
  const fixture = await db.fixture.upsert({
    where: { sourceId: "18241006" },
    update: {},
    create: {
      sourceId: "18241006",
      sourceMode: "LIVE",
      homeTeam: "Participant 1",
      awayTeam: "Participant 2",
      participant1Name: "Participant 1",
      participant2Name: "Participant 2",
      participant1IsHome: true,
      startsAt: new Date("2026-07-15T20:00:00Z"),
      status: "FINISHED",
    },
  });
  const observation = await db.scoreObservation.upsert({
    where: { fixtureId_providerSequence: { fixtureId: fixture.id, providerSequence: 962 } },
    update: {},
    create: {
      fixtureId: fixture.id,
      providerSequence: 962,
      providerTimestamp: new Date("2026-07-15T21:14:24Z"),
      action: "game_finalised",
      phase: "UNKNOWN",
      participant1Goals: 1,
      participant2Goals: 2,
      finalised: true,
      sourceMode: "LIVE",
    },
  });
  await db.scoreProofVerification.upsert({
    where: {
      network_fixtureSourceId_providerSequence_statKeyIdentity: {
        network: "devnet",
        fixtureSourceId: "18241006",
        providerSequence: 962,
        statKeyIdentity: "1,2",
      },
    },
    update: {},
    create: {
      fixtureId: fixture.id,
      scoreObservationId: observation.id,
      fixtureSourceId: "18241006",
      providerSequence: 962,
      network: "devnet",
      statKeys: [1, 2],
      statKeyIdentity: "1,2",
      statValues: [1, 2],
      fetchStatus: "FETCHED",
      validationStatus: "VERIFIED",
      observationClassification: "FINAL_MATCH_OBSERVATION",
      settlementEvidenceClassification: "FINAL_DATA_VERIFIED_NO_RECEIPT",
      proofPayloadDigest: "0abc3af2ebb38623b3d2e89ebb4e19071e4b867be814c7107d0fa7d8921808a7",
      programId: "6pW64gN1s2uqjHkn1unFeEjAwJkPGHoppGvS715wyP2J",
      dailyScoresPda: "HJ6nSVkUs4VG9JQ5sEUq3VbmyUSBf76ePXUCATLtRYTX",
      verifiedAt: new Date(),
    },
  });
} finally {
  await db.$disconnect();
}
