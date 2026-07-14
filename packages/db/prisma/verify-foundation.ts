import { PrismaClient } from "@prisma/client";
const db = new PrismaClient();
const failures: string[] = [];
if (Number(process.versions.node.split(".")[0]) !== 22)
  failures.push("Node major version is not 22");
try {
  await db.$queryRaw`SELECT 1`;
  const migration = await db.$queryRaw<
    Array<{ migration_name: string; finished_at: Date | null }>
  >`SELECT migration_name, finished_at FROM "_prisma_migrations" WHERE migration_name = '20260713000100_initial'`;
  if (migration.length !== 1 || !migration[0]?.finished_at)
    failures.push("Initial migration is not applied");
  const [users, fixtures] = await Promise.all([
    db.demoUser.count({ where: { id: "demo-user" } }),
    db.fixture.findMany({
      where: { sourceId: "synthetic-kora-savanna-001" },
      select: { id: true },
    }),
  ]);
  if (users !== 1) failures.push(`Expected one synthetic user, found ${users}`);
  if (fixtures.length !== 1)
    failures.push(`Expected one synthetic fixture, found ${fixtures.length}`);
  if (fixtures[0]) {
    const markets = await db.market.count({ where: { fixtureId: fixtures[0].id } });
    if (markets !== 3) failures.push(`Expected three synthetic markets, found ${markets}`);
  }
  const duplicates = await db.$queryRaw<
    Array<{ count: bigint }>
  >`SELECT COUNT(*)::bigint AS count FROM (SELECT "fixtureId", "ruleVersion" FROM "Market" GROUP BY 1,2 HAVING COUNT(*) > 1) duplicates`;
  if (Number(duplicates[0]?.count ?? 0) !== 0) failures.push("Duplicate seed records exist");
} catch {
  failures.push("Database connectivity or verification query failed");
} finally {
  await db.$disconnect();
}
if (failures.length) {
  console.error(JSON.stringify({ ok: false, failures }));
  process.exitCode = 1;
} else
  console.log(
    JSON.stringify({
      ok: true,
      node: process.version,
      database: "connected",
      initialMigration: "applied",
      syntheticUser: 1,
      syntheticFixture: 1,
      syntheticMarkets: 3,
      duplicates: 0,
    }),
  );
