#!/usr/bin/env node
const fs = require("fs");
const path = require("path");
const root = process.argv[2] || process.cwd();
const assets = fs.readFileSync(path.join(root, "src/client/game/renderers/local_dev/harthmere_assets.ts"), "utf8");
const contract = fs.readFileSync(path.join(root, "src/shared/harthmere/town_production_polish.ts"), "utf8");
const shim = fs.readFileSync(path.join(root, "src/server/shim/main.ts"), "utf8");
let ok = true;
function check(label, condition) { if (condition) console.log(`OK ${label}`); else { ok = false; console.error(`FAIL ${label}`); } }
const shardBudgetMatch = contract.match(/optimizedTerrainShardBudget:\s*(\d+)/);
check("current performance profile contract exists", contract.includes("HARTHMERE_RUNTIME_PERFORMANCE_PROFILE_VERSION") && contract.includes("maxRuntimePlacementsOptimized"));
check("prototype concurrency is reduced", Number((contract.match(/prototypeLoadConcurrency:\s*(\d+)/) || [])[1]) <= 3);
check("LOD distances are tightened", Number((contract.match(/districtLodDistanceMeters:\s*(\d+)/) || [])[1]) <= 96 && Number((contract.match(/tinyLodDistanceMeters:\s*(\d+)/) || [])[1]) <= 18);
check("renderer has optimized/full runtime profile switch", assets.includes("harthmereRuntimePerformanceProfile") && assets.includes("biomes.localDev.harthmere.performanceProfile") && assets.includes("shouldKeepHarthmerePlacementForPerformance"));
check("renderer drops non-core far runtime clutter before load", assets.includes("removedForPerformance") && assets.includes("maxWildsRuntimePlacementsOptimized"));
check("renderer enforces the total placement cap inside the core", assets.includes("keepWithinTotalBudget") && assets.includes("including core shells and repeated decor"));
check("district names cannot bypass the optimized cap", /isAlwaysImportant[\s\S]*?\.test\(\s*identityLabel\s*\)/.test(assets));
check("shim exposes full and optimized terrain bounds", shim.includes("HARTHMERE_FULL_WILDS_SHARD_X0") && shim.includes("HARTHMERE_OPTIMIZED_WILDS_SHARD_X0") && shim.includes("BIOMES_HARTHMERE_PERF_PROFILE"));
check("optimized terrain shard budget is under 500", shardBudgetMatch && Number(shardBudgetMatch[1]) <= 500);
check("fast harvestable blocks are clipped to active terrain", shim.includes("isHarthmereLocalDevTerrainShardEnabledForWorld") && shim.includes("if (!isHarthmereLocalDevTerrainShardEnabledForWorld(x, z))"));
check("stale legacy terrain shards are deleted after shrinking bounds", shim.includes("localDevLegacyTerrainShardIds") && shim.includes("makeLocalDevStaleTerrainDeletes") && shim.includes("changes.push(...makeLocalDevStaleTerrainDeletes"));
check("content pass logs bounded terrain", shim.includes("harthmere-town-design-rebuild-performance-bounded-terrain") && shim.includes("performanceProfile: HARTHMERE_LOCAL_DEV_PERF_PROFILE"));
if (!ok) process.exit(1);
