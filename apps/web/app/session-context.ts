import { accountForToken, DEMO_SESSION_COOKIE } from "@predict9ja/db";
import { cookies } from "next/headers";
import { requireDemoSessionSecret } from "./server-runtime";
export function demoSessionSecret() {
  return requireDemoSessionSecret();
}
export async function currentDemoAccount() {
  const token = (await cookies()).get(DEMO_SESSION_COOKIE)?.value;
  return token ? accountForToken(token, demoSessionSecret()) : null;
}
