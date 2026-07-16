import { runJudgeDemoSimulation } from "@predict9ja/db";
import { NextResponse } from "next/server";
import { currentDemoAccount } from "../../../session-context";

export async function POST() {
  try {
    const account = await currentDemoAccount();
    if (!account) return NextResponse.json({ code: "SESSION_REQUIRED" }, { status: 401 });
    const result = await runJudgeDemoSimulation(account.id);
    if (!result.state || !result.reconciliation.reconciled)
      return NextResponse.json({ code: "SIMULATION_FAILED" }, { status: 503 });
    return NextResponse.json({ ok: true, finalised: true });
  } catch {
    return NextResponse.json({ code: "SIMULATION_FAILED" }, { status: 503 });
  }
}
