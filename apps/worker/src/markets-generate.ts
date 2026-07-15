import { generateAllMarkets, generateMarketsForFixture } from "@predict9ja/db";
import { option } from "./arguments";
const fixtureId = option("fixture-id");
console.log(
  JSON.stringify(
    fixtureId ? await generateMarketsForFixture(fixtureId) : await generateAllMarkets(),
  ),
);
