import { TxlineRequestTimeoutError } from "@predict9ja/txline";

export const TXLINE_REQUEST_TIMEOUT_EXIT_CODE = 2;

export function safeTxlineCliError(error: unknown) {
  if (error instanceof TxlineRequestTimeoutError)
    return {
      ok: false,
      error: error.code,
      endpointCategory: error.endpointCategory,
    } as const;
  return null;
}

export async function runTxlineCli(task: () => Promise<void>) {
  try {
    await task();
  } catch (error) {
    const safe = safeTxlineCliError(error);
    if (!safe) throw error;
    console.log(JSON.stringify(safe));
    process.exitCode = TXLINE_REQUEST_TIMEOUT_EXIT_CODE;
  }
}
