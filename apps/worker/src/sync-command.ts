import { synchronizeFixtures } from "@predict9ja/db";
import { configFromEnvironment, createHttpTxlineClient } from "@predict9ja/txline";
const config = configFromEnvironment(process.env);
const snapshot = await createHttpTxlineClient(config).snapshots.getFixtures();
console.log(JSON.stringify(await synchronizeFixtures(snapshot)));
