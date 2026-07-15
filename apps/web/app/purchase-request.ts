import { z } from "zod";
export const purchaseRequestSchema = z
  .object({
    marketId: z.string().min(1),
    outcomeKey: z.string().min(1).max(32),
    stakeCredits: z.number().int().min(1).max(5000),
    quoteVersion: z.number().int().positive(),
    idempotencyKey: z.string().regex(/^[A-Za-z0-9_-]{8,80}$/),
  })
  .strict();
export function parsePurchaseRequest(value: unknown) {
  return purchaseRequestSchema.safeParse(value);
}
