import { PurchaseError, purchasePosition } from "@predict9ja/db";
import { NextResponse } from "next/server";
import { parsePurchaseRequest } from "../../../purchase-request";
import { currentDemoAccount } from "../../../session-context";
export async function POST(request: Request) {
  const account = await currentDemoAccount();
  if (!account) return NextResponse.json({ code: "SESSION_REQUIRED" }, { status: 401 });
  const parsed = parsePurchaseRequest(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ code: "INVALID_REQUEST" }, { status: 400 });
  try {
    const purchase = await purchasePosition(account.id, parsed.data);
    return NextResponse.json({
      purchaseId: purchase.id,
      stakeCredits: purchase.stakeCredits,
      sharesMicros: purchase.sharesMicros.toString(),
      potentialPayoutCredits: purchase.potentialPayoutCredits,
    });
  } catch (error) {
    if (error instanceof PurchaseError)
      return NextResponse.json(
        { code: error.code },
        { status: error.code === "INSUFFICIENT_CREDITS" ? 409 : 400 },
      );
    throw error;
  }
}
