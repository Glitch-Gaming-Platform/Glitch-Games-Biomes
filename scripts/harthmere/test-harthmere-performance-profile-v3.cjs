#!/usr/bin/env node
const fs = require("fs");
const path = require("path");
const root = process.argv[2] || process.cwd();
const assets = fs.readFileSync(path.join(root, "src/client/game/renderers/local_dev/harthmere_assets.ts"), "utf8");
const contract = fs.readFileSync(path.join(root, "src/shared/harthmere/town_production_polish_v1.ts"), "utf8");
const shim = fs.readFileSync(path.join(root, "src/server/shim/main.ts"), "utf8");
let ok = true;
function check(label, condition) { if (condition) console.log(`OK ${label}`); else { ok = false; console.error(`FAIL ${label}`); } }
const shardBudgetMatch = contract.match(/optimizedTerrainShardBudget:\s*(\d+)/);
check("v3 performance profile contract exists", contract.includes("HARTHMERE_RUNTIME_PERFORMANCE_PROFILE_VERSION_V3") && contract.includes("maxRuntimePlacementsOptimized"));
check("prototype concurrency is reduced", /prototypeLoadConcurrency:\s*3/.test(contract));
check("LOD distances are tightened", /districtLodDistanceMeters:\s*96/.test(contract) && /tinyLodDistanceMeters:\s*18/.test(contract));
check("renderer has optimized/full runtime profile switch", assets.includes("harthmereRuntimePerformanceProfileV3") && assets.includes("biomes.localDev.harthmere.performanceProfile") && assets.includes("shouldKeepHarthmerePlacementForPerformanceV3"));
check("renderer drops non-core far runtime clutter before load", assets.includes("removedForPerformance") && assets.includes("maxWildsRuntimePlacementsOptimized"));
check("shim exposes full and optimized terrain bounds", shim.includes("HARTHMERE_FULL_WILDS_SHARD_X0") && shim.includes("HARTHMERE_OPTIMIZED_WILDS_SHARD_X0") && shim.includes("BIOMES_HARTHMERE_PERF_PROFILE"));
check("optimized terrain shard budget is under 500", shardBudgetMatch && Number(shardBudgetMatch[1]) <= 500);
check("fast harvestable blocks are clipped to active terrain", shim.includes("isHarthmereLocalDevTerrainShardEnabledForWorldV3") && shim.includes("if (!isHarthmereLocalDevTerrainShardEnabledForWorldV3(x, z))"));
check("stale legacy terrain shards are deleted after shrinking bounds", shim.includes("localDevLegacyTerrainShardIdsV3") && shim.includes("makeLocalDevStaleTerrainDeletesV3") && shim.includes("changes.push(...makeLocalDevStaleTerrainDeletesV3"));
check("content pass logs bounded terrain", shim.includes("harthmere-town-design-rebuild-v17-performance-bounded-terrain") && shim.includes("performanceProfile: HARTHMERE_LOCAL_DEV_PERF_PROFILE_V3"));
if (!ok) process.exit(1);
