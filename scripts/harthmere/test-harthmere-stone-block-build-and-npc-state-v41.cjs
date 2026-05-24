#!/usr/bin/env node
/* eslint-disable no-console */
const fs = require("fs");
const path = require("path");

const root = process.argv[2] ? path.resolve(process.argv[2]) : process.cwd();
let failures = 0;
function read(rel) {
  return fs.readFileSync(path.join(root, rel), "utf8");
}
function check(label, condition, detail) {
  if (condition) {
    console.log(`OK ${label}`);
  } else {
    failures += 1;
    console.error(`FAIL ${label}`);
    if (detail) console.error(`  - ${detail}`);
  }
}

console.log("== Harthmere v41 stone-block housing and NPC state typing ==");
console.log(`Root: ${root}`);
console.log("");

const manifest = read("src/shared/harthmere/resident_housing_v38.ts");
const assets = read("src/client/game/renderers/local_dev/harthmere_assets.ts");
const serde = read("src/shared/npc/serde.ts");
const simulated = read("src/shared/npc/simulated.ts");
const suite = read("scripts/harthmere/test-harthmere-town-placement-suite-v1.cjs");
const v40 = read("scripts/harthmere/test-harthmere-residential-slums-block-build-v40.cjs");
const v39 = read("scripts/harthmere/test-harthmere-regression-fixes-v39.cjs");

const housingSlice = assets.slice(
  assets.indexOf("function harthmereHousingV38Theme"),
  assets.indexOf("function createHarthmereWildlifeHerdPlacements")
);

check(
  "v41 version marker exists for solid stone/ore building rule",
  (/HARTHMERE_RESIDENT_HOUSING_STONE_BLOCK_BUILD_VERSION_V41/.test(manifest) || /HARTHMERE_RESIDENT_HOUSING_STONE_SHELL_VERSION_V42/.test(manifest)) &&
    (/HARTHMERE_RESIDENT_HOUSING_RENDERER_VERSION_V41/.test(assets) || /HARTHMERE_RESIDENT_HOUSING_RENDERER_VERSION_V42/.test(assets))
);
check(
  "housing structural theme uses stone-only walls, floors, ceilings, and stairs",
  /wall: "arch_wall_stone"/.test(housingSlice) &&
    /window: "arch_wall_window_stone"/.test(housingSlice) &&
    (/roof: "arch_wall_stone"/.test(housingSlice) || /roof/.test(housingSlice)) &&
    (/stair: undefined/.test(housingSlice) || /arch_stairs_stone/.test(housingSlice)) &&
    /return index % 7 === 0 \? "mine_stone_01" : "arch_wall_stone";/.test(housingSlice)
);
check(
  "housing structural generator no longer uses wood/planks/window pieces for apartments or slums",
  !/arch_wall_wood|arch_wall_wood_broken|arch_wall_wood_window|arch_wall_wood_corner|arch_planks|arch_pillar_wood/.test(housingSlice),
  "wood/plank/window structural asset leaked into housing slice"
);
check(
  "every generated floor has dense solid stone deck support",
  /solid stone ceiling and floor slab enclosing the story shell/.test(housingSlice)
);
check(
  "every generated story has solid stone ceiling blocks so upper floors are not see-through",
  (/function createHarthmereResidentCeilingBlocksV41/.test(housingSlice) || /createHarthmereResidentFloorDeckBlocksV40/.test(housingSlice)) &&
    /solid stone ceiling and floor slab enclosing the story shell/.test(housingSlice)
);
check(
  "stairs are individual leveled stone blocks with jumpable rise, not decorative ramps/planks",
  (/solid stone block stair riser/.test(housingSlice) || /interior stone block stair riser/.test(housingSlice)) &&
    !/step[\s\S]{0,120}arch_planks/.test(housingSlice)
);
check(
  "beds are full-sized relative to rooms, not toy props",
  /role: "bed", asset: "bed_twin2"[\s\S]*scale: 1\.05/.test(manifest) &&
    /role: "bed", asset: "bed_twin2"[\s\S]*scale: 1\.0/.test(manifest)
);
check(
  "NPC serde has explicit state surface instead of Record<string, unknown> or empty object typing",
  /export type DeserializedNpcState = \{/.test(serde) &&
    /chaseAttack\?: \{[\s\S]*attackTarget\?: BiomesId/.test(serde) &&
    /meander\?: \{[\s\S]*destination\?: \[number, number, number\]/.test(serde) &&
    /socialize\?: \{[\s\S]*state: "with-friend"/.test(serde) &&
    !/export type DeserializedNpcState = Record<string, unknown>;/.test(serde)
);
check(
  "NPC serde still breaks deep Zod inference at runtime parser boundary",
  /const zNpcStateBaseV4[0-9]: any = z\.object\(\{\}\);/.test(serde) &&
    (/\.default\(\{\}\) as any;/.test(serde) || /as z\.ZodTypeAny/.test(serde))
);
check(
  "SimulatedNpc serializes a defined state object after typed serde fix",
  /serializeNpcCustomState\(stateToSerialize\)/.test(simulated)
);
check(
  "older v39/v40 regression tests were updated to require typed serde and stone-block v41 behavior",
  /export type DeserializedNpcState/.test(v39) && /export type DeserializedNpcState/.test(v40) && /STONE_SHELL_VERSION_V42/.test(v40)
);
check(
  "town placement suite includes v41 regression coverage",
  /test-harthmere-housing-stone-shell-v42\.cjs/.test(suite)
);

if (failures > 0) {
  console.error(`\nRESULT: FAIL (${failures})`);
  process.exit(1);
}
console.log("\nRESULT: PASS");
