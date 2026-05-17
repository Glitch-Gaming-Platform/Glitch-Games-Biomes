#!/usr/bin/env node
const fs = require("fs");
const path = require("path");
const root = process.argv[2] || process.cwd();
const assets = fs.readFileSync(path.join(root, "src/client/game/renderers/local_dev/harthmere_assets.ts"), "utf8");
let ok = true;
function check(label, condition) {
  if (condition) console.log(`OK ${label}`);
  else { console.error(`FAIL ${label}`); ok = false; }
}
check("roof cap version marker exists", assets.includes("HARTHMERE_SINGLE_STORY_ROOF_CAP_VERSION_V4"));
check("roof cap filter helper exists", assets.includes("function filterSingleStoryRoofExtrasV4("));
check("service buildings cap single-story roof extras", assets.includes("if (floors === 1)") && assets.includes("building.roofY ?? storyHeight - 0.12"));
check("housing caps single-story roof extras", assets.includes("if (building.floors === 1)") && assets.includes("harthmereResidentStoryHeightV40(building) - 0.18"));
if (!ok) process.exit(1);
