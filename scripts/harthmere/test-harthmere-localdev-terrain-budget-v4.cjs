#!/usr/bin/env node
const fs = require("fs");
const path = require("path");
const root = process.argv[2] || process.cwd();
const shim = fs.readFileSync(path.join(root, "src/server/shim/main.ts"), "utf8");
const budgets = fs.readFileSync(path.join(root, "src/shared/harthmere/town_production_polish_v1.ts"), "utf8");
let ok = true;
function check(label, condition) {
  if (condition) console.log(`OK ${label}`);
  else { console.error(`FAIL ${label}`); ok = false; }
}
check("local dev terrain bounds version marker exists", shim.includes("HARTHMERE_LOCAL_DEV_TERRAIN_BOUNDS_VERSION_V4"));
check("local dev shard bounds are reduced", shim.includes("const STARTER_TOWN_WILDS_SHARD_X0 = -2;") && shim.includes("const STARTER_TOWN_WILDS_SHARD_X1 = 20;") && shim.includes("const STARTER_TOWN_WILDS_SHARD_Z0 = -18;") && shim.includes("const STARTER_TOWN_WILDS_SHARD_Z1 = 2;"));
check("stale terrain deletion helper exists", shim.includes("function makeLocalDevObsoleteTerrainDeletionChanges(") && shim.includes("Pruning obsolete local dev terrain shards"));
check("render budgets reduced", budgets.includes("prototypeLoadConcurrency: 3") && budgets.includes("districtLodDistanceMeters: 105") && budgets.includes("nearLodDistanceMeters: 60") && budgets.includes("interiorLodDistanceMeters: 32"));
if (!ok) process.exit(1);
