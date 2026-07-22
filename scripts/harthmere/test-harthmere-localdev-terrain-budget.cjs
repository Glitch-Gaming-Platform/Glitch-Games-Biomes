#!/usr/bin/env node
const fs = require("fs");
const path = require("path");
const root = process.argv[2] || process.cwd();
const shim = fs.readFileSync(path.join(root, "src/server/shim/main.ts"), "utf8");
const budgets = fs.readFileSync(path.join(root, "src/shared/harthmere/town_production_polish.ts"), "utf8");
let ok = true;
function check(label, condition) {
  if (condition) console.log(`OK ${label}`);
  else { console.error(`FAIL ${label}`); ok = false; }
}
check("local dev terrain bounds version marker exists", shim.includes("HARTHMERE_LOCAL_DEV_TERRAIN_BOUNDS_VERSION"));
const optimizedBounds = {
  x0: Number((shim.match(/HARTHMERE_OPTIMIZED_WILDS_SHARD_X0\s*=\s*(-?\d+)/) || [])[1]),
  x1: Number((shim.match(/HARTHMERE_OPTIMIZED_WILDS_SHARD_X1\s*=\s*(-?\d+)/) || [])[1]),
  z0: Number((shim.match(/HARTHMERE_OPTIMIZED_WILDS_SHARD_Z0\s*=\s*(-?\d+)/) || [])[1]),
  z1: Number((shim.match(/HARTHMERE_OPTIMIZED_WILDS_SHARD_Z1\s*=\s*(-?\d+)/) || [])[1]),
};
check("local dev shard bounds are reduced", Number.isFinite(optimizedBounds.x0) && Number.isFinite(optimizedBounds.x1) && Number.isFinite(optimizedBounds.z0) && Number.isFinite(optimizedBounds.z1) && optimizedBounds.x0 >= -2 && optimizedBounds.x1 <= 23 && optimizedBounds.z0 >= -18 && optimizedBounds.z1 <= 5 && shim.includes("HARTHMERE_LOCAL_DEV_PERF_PROFILE"));
check("stale terrain deletion helper exists", shim.includes("function makeLocalDevObsoleteTerrainDeletionChanges(") && shim.includes("Pruning obsolete local dev terrain shards"));
check("additive terrain uses stable coordinate ids", shim.includes("harthmereExtensionTerrainEntityIdForShard(") && !shim.includes("LOCAL_DEV_TERRAIN_ID_BASE + idOffset++"));
check("additive terrain seeds the complete deep foundation", shim.includes("harthmereExtensionFoundationShardSpecs()") && shim.includes("from Y=-64 through the surface"));
check("retired terrain cleanup verifies terrain components", shim.includes("existingPreviousAdditiveTerrainIds(") && shim.includes("entity?.hasBox?.() && entity.hasShardSeed?.()"));
function numberFor(key) {
  const match = budgets.match(new RegExp(key + "\\s*:\\s*(\\d+)"));
  return match ? Number(match[1]) : NaN;
}
check("render budgets reduced", numberFor("prototypeLoadConcurrency") <= 3 && numberFor("districtLodDistanceMeters") <= 105 && numberFor("nearLodDistanceMeters") <= 60 && numberFor("interiorLodDistanceMeters") <= 32);
if (!ok) process.exit(1);
