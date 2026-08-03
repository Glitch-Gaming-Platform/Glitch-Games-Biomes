#!/usr/bin/env node
/*
 * HARTHMERE_RIVER_DEPLOY_DURABILITY_CONTRACT
 *
 * The Brell kept disappearing. Every deploy carved its channel, refused to
 * fill it with water, and then paved it over with soil — leaving exactly the
 * reported symptom: no river, uneven ground, and repairs that "did not work".
 *
 * The cause was that FOUR independent maintenance systems each treated any
 * column breaking the flat Y=52 plane as damage, and each carried its own
 * private list of exceptions containing exactly one entry (the Bellbinder
 * stair mouth):
 *
 *   1. `harthmereUnsolidSurfaceTerrainIds`  — marks holed shards for rebuild
 *   2. `harthmereSurfaceRepairColumnEdits`  — fills sub-grade columns to grade
 *   3. `audit-production-extension-terrain` — fails the deploy on a surface hole
 *   4. `terrainSeedEntityForWrite`          — writes shard_water on CREATE only
 *
 * This contract is a source-and-data check, so it runs in the no-browser
 * contract phase of the native-ECS gate and fails a deployment candidate
 * BEFORE it can flatten the river again. It deliberately asserts on the wiring
 * rather than only on the geometry: the geometry tests already pass in a world
 * where the river is about to be bulldozed.
 */
require("ts-node/register/transpile-only");
require("tsconfig-paths/register");

const fs = require("fs");
const path = require("path");
const assert = require("assert");

const root = process.argv[2] ? path.resolve(process.argv[2]) : process.cwd();
const read = (rel) => fs.readFileSync(path.join(root, rel), "utf8");

const {
  isHarthmereAuthoredWaterColumn,
  harthmereAuthoredWaterLevelAt,
  harthmereShardHasAuthoredWater,
  HARTHMERE_AUTHORED_WATER_GROUND_Y,
} = require("../../src/shared/harthmere/harthmere_authored_water");
const {
  HARTHMERE_RIVER_COURSE,
  harthmereRiverWaterDepthAt,
} = require("../../src/shared/harthmere/harthmere_river");
const {
  isHarthmereSurfaceRepairProtectedColumn,
  harthmereSurfaceRepairColumnEdits,
} = require("../../src/shared/harthmere/extension_surface_repair");
const {
  HARTHMERE_ADDITIVE_TOWN_OFFSET_X,
} = require("../../src/shared/harthmere/world_extension");

const failures = [];
function check(name, fn) {
  try {
    fn();
    console.log(`  ok  ${name}`);
  } catch (error) {
    failures.push({ name, message: error.message });
    console.error(`  FAIL ${name}\n       ${error.message}`);
  }
}

console.log("HARTHMERE_RIVER_DEPLOY_DURABILITY_CONTRACT");

// --- 1. The surface repair must never fill the channel ----------------------
check("surface repair protects every river column", () => {
  for (const [ax, az] of HARTHMERE_RIVER_COURSE) {
    const x = ax + HARTHMERE_ADDITIVE_TOWN_OFFSET_X;
    assert.ok(
      isHarthmereSurfaceRepairProtectedColumn(x, az),
      `repair would fill the river at authored ${ax},${az}`
    );
  }
});

check("surface repair emits no fill edits inside the channel", () => {
  const [ax, az] = HARTHMERE_RIVER_COURSE[8];
  const x = ax + HARTHMERE_ADDITIVE_TOWN_OFFSET_X;
  const result = harthmereSurfaceRepairColumnEdits(x, az, {
    surfaceY: HARTHMERE_AUTHORED_WATER_GROUND_Y - 5,
  });
  assert.equal(result.status, "protected");
  assert.equal(result.edits.length, 0);
});

// --- 2. The unsolid-surface scan must skip authored water -------------------
check("the shim's unsolid-surface scan exempts authored water", () => {
  const shim = read("src/server/shim/main.ts");
  assert.ok(
    shim.includes("isHarthmereAuthoredWaterColumn(worldX, worldZ)"),
    "harthmereUnsolidSurfaceTerrainIds no longer skips authored water; every " +
      "river shard will be reported holed on every boot"
  );
});

// --- 3. Authored water must not be gated behind an env flag -----------------
check("authored water is re-asserted on every deploy, not opt-in", () => {
  const shim = read("src/server/shim/main.ts");
  const gated = shim
    .split("\n")
    .filter(
      (line) =>
        line.includes("BIOMES_MIGRATE_HARTHMERE_AUTHORED_WATER") &&
        !line.trimStart().startsWith("//") &&
        !line.trimStart().startsWith("*")
    );
  assert.deepEqual(
    gated,
    [],
    "authored water is behind an opt-in env flag again; an ordinary deploy " +
      "will leave the channel dry and the repair will fill it in"
  );
});

// --- 4. shard_water must travel with the authored seed, not as a default ----
check("shard_water is authored data for river shards", () => {
  const shim = read("src/server/shim/main.ts");
  assert.ok(
    /\.\.\.\(kind === "update" && shardHasAuthoredWater/.test(shim),
    "shard_water is no longer written as authored data on update; " +
      "terrainSeedEntityForWrite only applies mutableDefaults on create, so " +
      "the river will be carved and left dry"
  );
});

check("river shards are recognised as carrying authored water", () => {
  const [ax, az] = HARTHMERE_RIVER_COURSE[8];
  const x = ax + HARTHMERE_ADDITIVE_TOWN_OFFSET_X;
  const shardX = Math.floor(x / 32) * 32;
  const shardZ = Math.floor(az / 32) * 32;
  const shardY = Math.floor(HARTHMERE_AUTHORED_WATER_GROUND_Y / 32) * 32;
  assert.ok(
    harthmereShardHasAuthoredWater(
      [shardX, shardY, shardZ],
      [shardX + 32, shardY + 32, shardZ + 32]
    ),
    "the shard the river runs through does not claim authored water"
  );
});

// --- 5. The terrain audit must not fail the deploy on the river -------------
check("the terrain audit asks the shared authored-water predicate", () => {
  const audit = read("scripts/harthmere/audit-production-extension-terrain.cjs");
  assert.ok(
    audit.includes("isHarthmereAuthoredWaterColumn"),
    "the terrain audit carries its own copy of the river test again; that " +
      "drift is what let the repair and the audit disagree"
  );
});

// --- 6. The river must be MATERIALIZED, not merely protected ----------------
//
// The production deploy passes HARTHMERE_SKIP_EXTENSION_TERRAIN_SEED=1, so the
// only writer that can cut the channel is the reconciliation materializer. If
// it stops running, exempting the channel from the surface repair leaves those
// columns sunken forever instead of filled — strictly worse than before.
check("reconciliation materializes authored water", () => {
  const recon = read("scripts/glitch/run-harthmere-production-reconciliation.sh");
  assert.ok(
    recon.includes("materialize-harthmere-authored-water.cjs"),
    "the reconciliation no longer materializes the river; with the terrain " +
      "seed skipped the channel can never be cut"
  );
  // Line-based on purpose: an `indexOf` over the raw text happily matches
  // inside a commented-out call, which is exactly how a first version of this
  // check passed while the materializer was unwired.
  const callLines = recon
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => !line.startsWith("#"));
  const repairAt = callLines.indexOf("repair_extension_surface");
  assert.ok(repairAt !== -1, "repair_extension_surface is never called");
  // The call IMMEDIATELY before the repair must be the materializer. Checking
  // only "appears somewhere earlier" is too weak: the town-only path also calls
  // it, so unwiring the main path still passed that version of this check.
  assert.equal(
    callLines[repairAt - 1],
    "materialize_authored_water",
    "authored water must be materialized immediately BEFORE the surface " +
      "repair, so the repair sees a real channel rather than an exempt hole"
  );
  // And the town-only path must keep it too.
  const calls = callLines.filter(
    (line) => line === "materialize_authored_water"
  );
  assert.ok(
    calls.length >= 2,
    "the river is materialized in only one reconciliation path; the " +
      "town-only path runs after targeted terrain maintenance and needs it too"
  );
});

check("the terrain-seed skip does not gate the materializer", () => {
  const recon = read("scripts/glitch/run-harthmere-production-reconciliation.sh");
  const fn = recon.slice(
    recon.indexOf("materialize_authored_water() {"),
    recon.indexOf("repair_extension_surface() {")
  );
  assert.ok(fn.length > 0, "materialize_authored_water is missing");
  assert.ok(
    !fn.includes("HARTHMERE_SKIP_EXTENSION_TERRAIN_SEED"),
    "the river materializer is gated by the terrain-seed skip, which the " +
      "production deploy always sets"
  );
});

// --- 7. The river must still be water you can fish ---------------------------
check("every course node holds water at the surface", () => {
  for (const [ax, az] of HARTHMERE_RIVER_COURSE) {
    const x = ax + HARTHMERE_ADDITIVE_TOWN_OFFSET_X;
    assert.equal(
      harthmereAuthoredWaterLevelAt(
        x,
        HARTHMERE_AUTHORED_WATER_GROUND_Y - 1,
        az
      ),
      15,
      `no water surface at authored ${ax},${az}`
    );
  }
});

check("the channel is deep enough for the normal-depth fish table", () => {
  // SHALLOW_WATER is 3 in src/shared/loot_tables/predicates.ts.
  const [ax, az] = HARTHMERE_RIVER_COURSE[8];
  const depth = harthmereRiverWaterDepthAt(ax, az);
  assert.ok(depth > 3, `centre depth ${depth} only rolls the shallow table`);
});

check("authored water is recognised in WORLD coordinates", () => {
  // The maintenance passes are world-space and the generators are authored
  // space; mixing them is how this went wrong the first time.
  const [ax, az] = HARTHMERE_RIVER_COURSE[8];
  assert.ok(
    isHarthmereAuthoredWaterColumn(ax + HARTHMERE_ADDITIVE_TOWN_OFFSET_X, az)
  );
  assert.ok(!isHarthmereAuthoredWaterColumn(ax, az));
});

if (failures.length) {
  console.error(
    `\nHARTHMERE_RIVER_DEPLOY_DURABILITY_CONTRACT FAILED (${failures.length})`
  );
  process.exit(1);
}
console.log("\nHARTHMERE_RIVER_DEPLOY_DURABILITY_CONTRACT ok");
