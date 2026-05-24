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
function numberAfter(src, re) {
  const m = src.match(re);
  return m ? Number(m[1]) : Number.NaN;
}

console.log("== Harthmere residential/slums block-built accessibility v40 ==");
console.log(`Root: ${root}`);
console.log("");

const manifest = read("src/shared/harthmere/resident_housing_v38.ts");
const assets = read("src/client/game/renderers/local_dev/harthmere_assets.ts");
const serde = read("src/shared/npc/serde.ts");
const suite = read("scripts/harthmere/test-harthmere-town-placement-suite-v1.cjs");

check(
  "v40 keeps prior fixes and adds block-built resident housing version marker",
  /HARTHMERE_RESIDENT_HOUSING_BLOCK_BUILD_VERSION_V40/.test(manifest) && /HARTHMERE_RESIDENT_HOUSING_RENDERER_VERSION_V40/.test(assets) && /HARTHMERE_RESIDENT_HOUSING_STONE_SHELL_VERSION_V42/.test(manifest) && /HARTHMERE_RESIDENT_HOUSING_RENDERER_VERSION_V42/.test(assets)
);
check(
  "slum and residential buildings are generated from solid stone/ore blocks, not floating-only props",
  /createHarthmereResidentWallBlocksV40/.test(assets) &&
    /arch_wall_stone/.test(assets) &&
    (/solid stone\/ore house shell/.test(assets) || /BUILDING_V2_VOXEL_MESHES whole voxel building mesh/.test(assets)) &&
    /solid stone ceiling and floor slab enclosing the story shell/.test(assets)
);
check(
  "resident housing no longer uses one generic generated shell for vertical slum stacks",
  /function createHarthmereResidentHousingV38Placements\(\)[\s\S]*createHarthmereResidentStoryFrameV38\(building\)[\s\S]*createHarthmereResidentRoomDecorPlacementsV38\(building\)/.test(assets) &&
    !/function createHarthmereResidentHousingV38Placements\(\)[\s\S]*createBuildingShell\(\{[\s\S]*name: building\.name/.test(assets)
);
check(
  "each floor has real floor deck support before room decor is placed",
  /createHarthmereResidentFloorDeckBlocksV40/.test(assets) &&
    /solid stone ceiling and floor slab enclosing the story shell/.test(assets) &&
    /placed on block floor deck/.test(assets)
);
const maxRise = numberAfter(assets, /HARTHMERE_RESIDENT_BLOCK_STAIR_MAX_RISE_V40 = ([0-9.]+)/);
const minTread = numberAfter(assets, /HARTHMERE_RESIDENT_BLOCK_STAIR_MIN_TREAD_V40 = ([0-9.]+)/);
check(
  "stairs are built from leveled block risers with jumpable rise and player/NPC treads",
  Number.isFinite(maxRise) && maxRise <= 0.45 &&
    Number.isFinite(minTread) && minTread >= 0.7 &&
    /createHarthmereBlockStairRunV40/.test(assets) &&
    (/solid stone block stair riser/.test(assets) || /BUILDING_V2_VOXEL_MESHES exterior voxel stair mesh/.test(assets)) &&
    (/npc travel tread/.test(assets) || /upper-floor access doorway clear walkable/.test(assets)),
  `maxRise=${maxRise}, minTread=${minTread}`
);
const residentialBedScale = numberAfter(manifest, /role: "bed", asset: "bed_twin2"[\s\S]*?scale: ([0-9.]+), label: "full-size made bed/);
const slumBedScale = numberAfter(manifest, /role: "bed", asset: "bed_twin2"[\s\S]*?scale: ([0-9.]+), label: "full-size patched/);
check(
  "beds use full-size scale standards instead of tiny toy props",
  residentialBedScale >= 1.0 && slumBedScale >= 0.95,
  `residential=${residentialBedScale}, slum=${slumBedScale}`
);
check(
  "old floating upper-floor balcony/accessibility marker wording is gone",
  !/resident balcony cloth visual marker/.test(assets) &&
    !/landing clear accessibility anchor visual only/.test(assets)
);
check(
  "serde fixes the real TypeScript issue by breaking the deep Zod inference chain while preserving behavior state types",
  /const zNpcStateBaseV4[0-9]: any = z\.object\(\{\}\);/.test(serde) &&
    (/\.default\(\{\}\) as any;/.test(serde) || /as z\.ZodTypeAny/.test(serde)) &&
    /export type DeserializedNpcState = \{/.test(serde) &&
    /chaseAttack\?: \{[\s\S]*attackTarget\?: BiomesId/.test(serde)
);
check(
  "town placement suite includes v40 regression coverage",
  /test-harthmere-residential-slums-block-build-v40\.cjs/.test(suite)
);

if (failures > 0) {
  console.error(`\nRESULT: FAIL (${failures})`);
  process.exit(1);
}
console.log("\nRESULT: PASS");
