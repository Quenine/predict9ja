import { requiredOption } from "./arguments";
import { fetchProof, safeFetchSummary, statKeysFromArguments } from "./proof-workflow";

const result = await fetchProof({
  fixtureId: requiredOption("fixture-id"),
  sequence: Number(requiredOption("sequence")),
  statKeys: statKeysFromArguments(),
});
console.log(JSON.stringify(safeFetchSummary(result)));
if (!result.ok) process.exitCode = 2;
