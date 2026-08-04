import assert from "assert";
import fs from "fs";
import path from "path";

describe("Harthmere town repair persisted-world audit", () => {
  const source = fs.readFileSync(
    path.join(
      process.cwd(),
      "scripts/harthmere/audit-harthmere-town-repair.cjs"
    ),
    "utf8"
  );
  const repairSource = fs.readFileSync(
    path.join(
      process.cwd(),
      "scripts/harthmere/repair-harthmere-town-production.cjs"
    ),
    "utf8"
  );

  it("gates the authored surfaces, medieval roofs, water, and retired NPCs", () => {
    for (const contract of [
      "auditTownSurface",
      "auditBuildingRoofs",
      "HARTHMERE_RETIRED_GENERIC_TOWNSPERSON_IDS",
      "persistentBusinessCustomersAreAllowed",
      "riverWaterLevel",
      "HARTHMERE_TOWN_REPAIR_READY",
    ]) {
      assert.ok(
        source.includes(contract),
        `missing audit contract ${contract}`
      );
    }
  });

  it("uses the canonical source-level Brell probe and no write API", () => {
    assert.ok(source.includes("waterLevelAt(2214, 51, -174)"));
    assert.ok(/riverWaterLevel,\s+15/.test(source));
    assert.ok(!source.includes("redis.set("));
    assert.ok(!source.includes("worldApi.apply"));
  });

  it("can isolate the town gate from the separately-owned water gate", () => {
    assert.ok(source.includes("HARTHMERE_TOWN_REPAIR_SKIP_WATER"));
    assert.ok(source.includes("riverWaterLevel = SKIP_WATER"));
  });

  it("ships a versioned, overlay-preserving persisted-world writer", () => {
    for (const contract of [
      "harthmere-town-production-repair-v2",
      "loadCanonicalTerrainBuilder",
      "entity.setShardSeed",
      "HARTHMERE_RETIRED_GENERIC_TOWNSPERSON_IDS",
      "HARTHMERE_TOWN_TARGETED_REPAIR_READY",
      "harthmereTownStreetRects",
      "addCanonicalShardTarget",
    ]) {
      assert.ok(repairSource.includes(contract), `missing ${contract}`);
    }
    assert.ok(!repairSource.includes("setShardWater"));
    assert.ok(!repairSource.includes("mutableShardWater"));
    assert.ok(!repairSource.includes("HARTHMERE_BUSINESS_CUSTOMER_NPC_SEEDS"));
  });
});
