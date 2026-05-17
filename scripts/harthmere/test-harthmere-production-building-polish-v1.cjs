#!/usr/bin/env node
const fs = require("fs");
const path = require("path");

const root = process.argv[2] || process.cwd();
const assetsPath = path.join(root, "src/client/game/renderers/local_dev/harthmere_assets.ts");
const contractPath = path.join(root, "src/shared/harthmere/town_production_polish_v1.ts");
const assets = fs.readFileSync(assetsPath, "utf8");
const contract = fs.readFileSync(contractPath, "utf8");

let ok = true;
function check(label, condition) {
  if (condition) {
    console.log(`OK ${label}`);
  } else {
    ok = false;
    console.error(`FAIL ${label}`);
  }
}

check("production polish contract exists", contract.includes("HARTHMERE_PRODUCTION_POLISH_VERSION_V1"));
check("contract references bible palette families", ["stoneFortification", "timberWork", "warmMarket", "faithCalm", "povertySoot", "waterNight"].every((s) => contract.includes(s)));
check("renderer imports production polish contract", assets.includes("town_production_polish_v1"));
check("renderer declares production polish runtime version", assets.includes("HARTHMERE_PRODUCTION_POLISH_RUNTIME_VERSION_V1"));
check("renderer adds exterior polish function", assets.includes("function createHarthmereBuildingExteriorPolishV1"));
check("createBuildingShell applies exterior polish", /createHarthmereBuildingExteriorPolishV1\(shell,\s*\{[\s\S]*?v44Floor[\s\S]*?storyHeight[\s\S]*?roofY/.test(assets));
check("polish uses bounded placement budget", assets.includes("maxExteriorAccentPlacementsPerBuilding"));
check("polish preserves doorway clearance", assets.includes("door-clearance-preserved"));
check("polish has structural support not random bumps", /structural support buttress|functional-protrusions-only/.test(assets + contract));
check("polish has clean silhouette rule", /clean readable silhouette|clean-readable-silhouette/.test(assets + contract));
check("polish has icon first signage", /icon first|icon-first-service-signage/.test(assets + contract));
check("polish avoids random wall clutter", !/grounded lived-in clutter at wall base/.test(assets) && !/horizontal striation band left|horizontal striation band right/.test(assets));
check("polish uses known lightweight service assets", ["obj_sign_post", "arch_roof_window"].every((s) => assets.includes(s)));

if (!ok) process.exit(1);
