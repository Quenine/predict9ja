import { settleFixture } from "@predict9ja/db";
import { requiredOption } from "./arguments";
console.log(JSON.stringify(await settleFixture(requiredOption("fixture-id"))));
