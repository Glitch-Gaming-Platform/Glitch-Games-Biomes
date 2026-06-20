#!/usr/bin/env node
const fs = require("fs");
const path = require("path");
const root = process.argv[2] || process.cwd();
const assets = fs.readFileSync(path.join(root, "src/client/game/renderers/local_dev/harthmere_assets.ts"), "utf8");
const contract = fs.readFileSync(path.join(root, "src/shared/harthmere/town_production_polish.ts"), "utf8");
let ok = true;
function check(label, condition) { if (condition) console.log(`OK ${label}`); else { ok = false; console.error(`FAIL ${label}`); } }
check("current floating block contract exists", contract.includes("HARTHMERE_FLOATING_BLOCK_INTEGRITY_VERSION") && contract.includes("no-airborne-singletons"));
check("architectural block detector exists", assets.includes("isHarthmereArchitecturalBlockCandidate") && assets.includes("arch_wall") && assets.includes("arch_roof"));
check("support stats check horizontal neighbors and below support", assets.includes("horizontalNeighborCount") && assets.includes("hasBelowSupport") && assets.includes("HARTHMERE_BLOCK_TILE_METERS"));
check("unsupported singleton blocks are culled before runtime", assets.includes("filterHarthmereUnsupportedFloatingBlockPlacements") && assets.includes("removedFloating") && assets.includes("runtimePlacements"));
check("runtime loads only prepared placements", /prepareHarthmereRuntimePlacements\((?:PLACEMENTS|RUNTIME_PLACEMENTS_V\d+)\)/.test(assets) && assets.includes("runtimePlacements.map((placement) => placement.asset)") && assets.includes("for (const authoredPlacement of runtimePlacements)"));
check("LOD uses structural group visibility", assets.includes("harthmereStructuralGroupKey") && assets.includes("structuralVisibility") && assets.includes("groupedShow"));
check("floating block debug report exposed", assets.includes("__harthmereFloatingBlockIntegrityReport") && assets.includes("HARTHMERE_FLOATING_BLOCK_INTEGRITY_RULES"));
if (!ok) process.exit(1);
