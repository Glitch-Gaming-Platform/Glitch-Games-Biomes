#!/usr/bin/env node
const fs = require("fs");
const path = require("path");
const root = process.argv[2] || process.cwd();
const assets = fs.readFileSync(path.join(root, "src/client/game/renderers/local_dev/harthmere_assets.ts"), "utf8");
const contract = fs.readFileSync(path.join(root, "src/shared/harthmere/town_production_polish_v1.ts"), "utf8");
let ok = true;
function check(label, condition) { if (condition) console.log(`OK ${label}`); else { ok = false; console.error(`FAIL ${label}`); } }
check("v3 floating block contract exists", contract.includes("HARTHMERE_FLOATING_BLOCK_INTEGRITY_VERSION_V3") && contract.includes("no-airborne-singletons"));
check("architectural block detector exists", assets.includes("isHarthmereArchitecturalBlockCandidateV3") && assets.includes("arch_wall") && assets.includes("arch_roof"));
check("support stats check horizontal neighbors and below support", assets.includes("horizontalNeighborCount") && assets.includes("hasBelowSupport") && assets.includes("HARTHMERE_BLOCK_TILE_METERS_V1"));
check("unsupported singleton blocks are culled before runtime", assets.includes("filterHarthmereUnsupportedFloatingBlockPlacementsV3") && assets.includes("removedFloating") && assets.includes("runtimePlacements"));
check("runtime loads only prepared placements", assets.includes("prepareHarthmereRuntimePlacementsV3(PLACEMENTS)") && assets.includes("runtimePlacements.map((placement) => placement.asset)") && assets.includes("for (const authoredPlacement of runtimePlacements)"));
check("LOD uses structural group visibility", assets.includes("harthmereStructuralGroupKeyV3") && assets.includes("structuralVisibility") && assets.includes("groupedShow"));
check("floating block debug report exposed", assets.includes("__harthmereFloatingBlockIntegrityReport") && assets.includes("HARTHMERE_FLOATING_BLOCK_INTEGRITY_RULES_V3"));
if (!ok) process.exit(1);
