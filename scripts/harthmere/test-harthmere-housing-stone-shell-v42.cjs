#!/usr/bin/env node
/* eslint-disable no-console */
const fs = require("fs");
const path = require("path");
const root = process.argv[2] ? path.resolve(process.argv[2]) : process.cwd();
let failures = 0;
function read(rel) { return fs.readFileSync(path.join(root, rel), "utf8"); }
function check(label, condition, detail) {
  if (condition) {
    console.log(`OK ${label}`);
  } else {
    failures += 1;
    console.error(`FAIL ${label}`);
    if (detail) console.error(`  - ${detail}`);
  }
}
console.log("== Harthmere housing stone story-shells v42 ==");
console.log(`Root: ${root}`);
console.log("");
const manifest = read("src/shared/harthmere/resident_housing_v38.ts");
const assets = read("src/client/game/renderers/local_dev/harthmere_assets.ts");
const serde = read("src/shared/npc/serde.ts");
const simulated = read("src/shared/npc/simulated.ts");
const suite = read("scripts/harthmere/test-harthmere-town-placement-suite-v1.cjs");
check("v42 version marker exists", /HARTHMERE_RESIDENT_HOUSING_STONE_SHELL_VERSION_V42/.test(manifest) && /HARTHMERE_RESIDENT_HOUSING_RENDERER_VERSION_V42/.test(assets));
check("housing structural generator uses enclosed stacked story shells instead of dense floating block fields", /createBuildingShell\(storyShell\)/.test(assets) && /solid stone\/ore house shell/.test(assets) && !/reinforced floor deck block hard support walkable surface/.test(assets));
check("housing generator uses stone-only structural theme definitions", /wall: building\.style === "slum" \? "arch_wall_broken" : "arch_wall_stone"/.test(assets) && /window: "arch_wall_window_stone"/.test(assets) && /stair: undefined/.test(assets));
check("stairs are interior stone block risers", /interior stone block stair riser/.test(assets) && /"arch_wall_stone"/.test(assets));
check("story ceilings and floors are enclosed by stone slabs so rooms are not see-through", /solid stone ceiling and floor slab enclosing the story shell/.test(assets));
check("serde exports an explicit typed state surface including structured memory", /export type DeserializedNpcState = \{/.test(serde) && /export type NpcMemoryState = \{/.test(serde));
check("simulated npc serializes a defined typed state object", /const stateToSerialize =/.test(simulated));
check("town placement suite includes v42 regression coverage", /test-harthmere-housing-stone-shell-v42\.cjs/.test(suite));
if (failures > 0) {
  console.error(`\nRESULT: FAIL (${failures})`);
  process.exit(1);
}
console.log("\nRESULT: PASS");
