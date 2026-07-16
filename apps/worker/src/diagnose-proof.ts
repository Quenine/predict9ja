import { requiredOption } from "./arguments";
import { runDiagnostic } from "./diagnostic-workflow";
import { statKeysFromArguments } from "./proof-workflow";

try {
  const result = await runDiagnostic({
    fixtureId: requiredOption("fixture-id"),
    sequence: Number(requiredOption("sequence")),
    statKeys: statKeysFromArguments(),
  });
  console.log(JSON.stringify(result));
} catch (error) {
  console.log(
    JSON.stringify({
      diagnosed: false,
      safeErrorCategory:
        error instanceof Error && error.message === "PERSISTED_PROOF_NOT_AVAILABLE"
          ? error.message
          : "DIAGNOSTIC_FAILED",
    }),
  );
  process.exitCode = 2;
}
