import { resolveFixture } from "@predict9ja/db";
import { requiredOption } from "./arguments";
const fixtureId = requiredOption("fixture-id");
const commit = process.argv.includes("--commit");
if (!commit && !process.argv.includes("--dry-run")) throw new Error("Use --dry-run or --commit");
console.log(JSON.stringify(await resolveFixture(fixtureId, commit)));
