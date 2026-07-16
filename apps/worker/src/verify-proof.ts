import { requiredOption } from "./arguments";
import { safeVerificationSummary, statKeysFromArguments, verifyProof } from "./proof-workflow";

const result = await verifyProof({
  fixtureId: requiredOption("fixture-id"),
  sequence: Number(requiredOption("sequence")),
  statKeys: statKeysFromArguments(),
});
console.log(JSON.stringify(safeVerificationSummary(result)));
if (!result.ok) process.exitCode = 2;
