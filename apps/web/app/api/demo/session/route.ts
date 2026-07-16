import { createDemoSession, DEMO_SESSION_COOKIE, revokeDemoSession } from "@predict9ja/db";
import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { demoSessionSecret } from "../../../session-context";
import { WebRuntimeEnvironmentError } from "../../../server-runtime";
export async function POST() {
  try {
    const secret = demoSessionSecret();
    const current = (await cookies()).get(DEMO_SESSION_COOKIE)?.value;
    if (current) await revokeDemoSession(current, secret);
    const result = await createDemoSession(secret);
    const response = NextResponse.json({ balance: result.account.availableCredits, demo: true });
    response.cookies.set(DEMO_SESSION_COOKIE, result.token, {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      path: "/",
      maxAge: 60 * 60 * 24,
    });
    return response;
  } catch (error) {
    if (error instanceof WebRuntimeEnvironmentError)
      return NextResponse.json({ ok: false, error: error.code }, { status: 503 });
    return NextResponse.json({ ok: false, error: "SESSION_CREATION_FAILED" }, { status: 503 });
  }
}
