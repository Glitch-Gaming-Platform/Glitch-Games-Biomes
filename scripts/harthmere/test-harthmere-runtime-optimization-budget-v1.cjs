#!/usr/bin/env node
const fs = require("fs");
const path = require("path");

const root = process.argv[2] || process.cwd();
const assetsPath = path.join(root, "src/client/game/renderers/local_dev/harthmere_assets.ts");
const registryPath = path.join(root, "src/shared/harthmere/town_registry.ts");
const contractPath = path.join(root, "src/shared/harthmere/town_production_polish_v1.ts");
const assets = fs.readFileSync(assetsPath, "utf8");
const registry = fs.readFileSync(registryPath, "utf8");
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

check("optimization budget contract exists", contract.includes("HARTHMERE_PRODUCTION_POLISH_RENDER_BUDGETS_V1"));
check("prototype load concurrency configured", /prototypeLoadConcurrency:\s*[1-9]/.test(contract));
check("renderer loads prototypes in bounded batches", assets.includes("loadHarthmerePrototypeBatchV1") && assets.includes("await this.loadHarthmerePrototypeBatchV1(requiredAssets)"));
check("renderer no longer loads every prototype through one Promise.all", !assets.includes("await Promise.all(requiredAssets.map((key) => this.loadPrototype(key)))"));
check("renderer yields between prototype batches", assets.includes("setTimeout(resolve, 0)"));
check("renderer exposes polish performance debug data", assets.includes("__harthmereTownRegistry") && assets.includes("lodBudgets") && assets.includes("prototypeLoadConcurrency"));
check("registry imports optimization budget", registry.includes("town_production_polish_v1"));
check("registry demotes generic walls/buildings from always-visible", registry.includes("return \"district\";") && registry.includes("battered foundation") && registry.includes("block-built v44"));
check("registry keeps named landmarks always visible", /north gate\|gatehouse\|old bridge\|bridge\|chapel/.test(registry));
check("LOD distances use budget constants", ["districtLodDistanceMeters", "nearLodDistanceMeters", "interiorLodDistanceMeters", "tinyLodDistanceMeters", "eventLodDistanceMeters"].every((s) => registry.includes(s)));

if (!ok) process.exit(1);
