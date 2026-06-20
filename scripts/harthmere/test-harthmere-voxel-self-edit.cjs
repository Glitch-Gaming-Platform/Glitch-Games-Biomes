#!/usr/bin/env node
const fs = require("fs");
const path = require("path");

const root = process.argv[2] || process.cwd();
const assetsPath = path.join(root, "src/client/game/renderers/local_dev/harthmere_assets.ts");
const contractPath = path.join(root, "src/shared/harthmere/town_production_polish.ts");
const assets = fs.readFileSync(assetsPath, "utf8");
const contract = fs.readFileSync(contractPath, "utf8");

let ok = true;
function check(label, condition) {
  if (condition) console.log(`OK ${label}`);
  else { ok = false; console.error(`FAIL ${label}`); }
}

const budgetMatch = contract.match(/maxExteriorAccentPlacementsPerBuilding:\s*(\d+)/);
const maxAccentBudget = budgetMatch ? Number(budgetMatch[1]) : NaN;

check("current self-edit rules are declared", contract.includes("HARTHMERE_PRODUCTION_VOXEL_SELF_EDIT_RULES"));
check("current enforces 70/30 rest/detail concept", contract.includes("70-30-rest-detail-ratio") && assets.includes("70% of the facade clean"));
check("current enforces clean silhouette", contract.includes("clean-readable-silhouette") && assets.includes("clean readable silhouette"));
check("current forbids pointless/random block clutter", contract.includes("no-pointless-blocks") && contract.includes("delete-random-wall-clutter"));
check("current requires functional protrusions", contract.includes("functional-protrusions-only") && assets.includes("functional protrusion"));
check("current requires structural support under weight", contract.includes("structural-support-under-weight") && assets.includes("structural support buttress"));
check("current uses layered depth for doors/windows/signs", contract.includes("layered-depth-door-window-pillar") && assets.includes("layered depth"));
check("current caps exterior accents tightly", Number.isFinite(maxAccentBudget) && maxAccentBudget <= 5);
check("current removes duplicated generic district banners", !assets.includes('BP(t.banner, shell, -hw * 0.72, hd + 0.3, 0, 0.72, "district banner", 1.2)'));
check("current keeps signs only for service or landmark shells", assets.includes("harthmereProductionPolishIsServiceOrLandmark") && assets.includes("service landmark accent icon first readable sign"));
check("current no longer places old clutter everywhere", !assets.includes("accents.clutter") && !assets.includes("grounded lived-in clutter at wall base"));
check("current exposes self-edit debug rules", assets.includes("selfEditRules") && assets.includes("HARTHMERE_PRODUCTION_VOXEL_SELF_EDIT_RULES"));

if (!ok) process.exit(1);
