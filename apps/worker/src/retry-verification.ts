import { requiredOption } from "./arguments";
import { retryDiagnostic } from "./diagnostic-workflow";

try {
  console.log(JSON.stringify(await retryDiagnostic(requiredOption("verification-id"))));
} catch (error) {
  console.log(
    JSON.stringify({
      retried: false,
      safeErrorCategory:
        error instanceof Error &&
        ["VERIFICATION_NOT_FOUND", "PERSISTED_PROOF_NOT_AVAILABLE"].includes(error.message)
          ? error.message
          : "DIAGNOSTIC_FAILED",
    }),
  );
  process.exitCode = 2;
}
