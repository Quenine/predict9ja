import { accountForToken, DEMO_SESSION_COOKIE } from "@predict9ja/db";
import { cookies } from "next/headers";
export function demoSessionSecret() {
  const secret = process.env.DEMO_SESSION_SECRET;
  if (!secret) throw new Error("DEMO_SESSION_SECRET is required");
  return secret;
}
export async function currentDemoAccount() {
  const token = (await cookies()).get(DEMO_SESSION_COOKIE)?.value;
  return token ? accountForToken(token, demoSessionSecret()) : null;
}
