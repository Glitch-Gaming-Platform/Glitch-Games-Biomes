#!/usr/bin/env node
const fs = require("fs");
const path = require("path");

const root = process.argv[2] || process.cwd();
const target = path.join(
  root,
  "src/client/game/renderers/local_dev/harthmere_assets.ts",
);

let ok = true;
function check(name, condition) {
  if (condition) {
    console.log(`OK ${name}`);
  } else {
    ok = false;
    console.error(`FAIL ${name}`);
  }
}

const source = fs.readFileSync(target, "utf8");

check("register actor summary type exists", source.includes("type HarthmereRegisterActorDebugSummary"));
check("verbose renderer debug flag exists", source.includes("biomes.localDev.harthmere.rendererVerbose"));
check("register_actor debug is summarized", source.includes('stage === "renderer.register_actor"') && source.includes("recordHarthmereRegisterActorDebug(payload)"));
check("register_actor console spam disabled by default", source.includes("!harthmereVerboseRendererDebugEnabled()") && source.includes("return;"));
check("load_complete includes registerActorSummary", source.includes("registerActorSummary: snapshotHarthmereRegisterActorSummary()"));
check("load_complete builds appearanceDebugActors", source.includes("const appearanceDebugActors = this.combatLifeInstances.slice(0, 80).map"));
check("window appearance report is exposed", source.includes("__harthmereRendererAppearanceReport"));
check("appearance report includes role/species/equipment", source.includes("appearanceRole: appearance?.role") && source.includes("appearanceSpecies: appearance?.species") && source.includes("equipment: appearance?.equipment"));
check("appearance report includes anchor data", source.includes("anchors: appearance?.anchors"));
check("appearance report checks face/body presence", source.includes("hasFace: Boolean(appearance?.face)") && source.includes("hasBody: Boolean(appearance?.body)"));

console.log("");
console.log(ok ? "RESULT: PASS" : "RESULT: FAIL");
process.exit(ok ? 0 : 1);
