import { requiredOption } from "./arguments";
import { latestProofInput, safeVerificationSummary, verifyProof } from "./proof-workflow";

const input = await latestProofInput(requiredOption("fixture-id"));
const result = await verifyProof(input);
console.log(JSON.stringify(safeVerificationSummary(result)));
if (!result.ok) process.exitCode = 2;
