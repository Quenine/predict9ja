import { db } from "@predict9ja/db";
import { NextResponse } from "next/server";
import { requireWebDatabaseEnvironment, WebRuntimeEnvironmentError } from "../../server-runtime";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    requireWebDatabaseEnvironment();
  } catch (error) {
    if (error instanceof WebRuntimeEnvironmentError)
      return NextResponse.json({
        status: "degraded",
        database: "misconfigured",
        migrationsCompatible: false,
        evidenceAvailable: false,
        syntheticFixtureAvailable: false,
      });
  }
  try {
    const result = await Promise.race([
      Promise.all([
        db.$queryRawUnsafe("SELECT 1"),
        db.scoreProofVerification.count({
          where: {
            fixtureSourceId: "18241006",
            providerSequence: 962,
            validationStatus: "VERIFIED",
            observationClassification: "FINAL_MATCH_OBSERVATION",
          },
        }),
        db.fixture.count({ where: { sourceId: "synthetic-kora-savanna-001" } }),
      ]),
      new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error("HEALTH_TIMEOUT")), 8_000),
      ),
    ]);
    return NextResponse.json({
      status: "ok",
      database: "connected",
      migrationsCompatible: true,
      evidenceAvailable: result[1] > 0,
      syntheticFixtureAvailable: result[2] > 0,
    });
  } catch {
    return NextResponse.json({
      status: "degraded",
      database: "unavailable",
      migrationsCompatible: false,
      evidenceAvailable: false,
      syntheticFixtureAvailable: false,
    });
  }
}
