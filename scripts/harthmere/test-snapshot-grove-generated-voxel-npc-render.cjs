#!/usr/bin/env node
const fs = require("fs");
const path = require("path");

const root = path.resolve(__dirname, "../..");
const read = (rel) => fs.readFileSync(path.join(root, rel), "utf8");

const npcs = read("src/client/game/resources/npcs.ts");
const grove = read("src/shared/harthmere/snapshot_grove_content.ts");
const building = read("src/shared/harthmere/building_system.ts");
const economy = read("src/shared/harthmere/grove_economy_starter.ts");

let failures = 0;
function ok(condition, message) {
  if (condition) {
    console.log(`PASS: ${message}`);
  } else {
    console.error(`FAIL: ${message}`);
    failures += 1;
  }
}

const assetMap = new Map(
  [...npcs.matchAll(/\b([a-zA-Z0-9_]+):\s*"npcs\/([^"]+)"/g)].map((match) => [
    match[1],
    match[2],
  ])
);

const assetBackedGroveNpcIds = [
  "jackie",
  "ranger_jane",
  "luis",
  "taye",
  "alexis",
  "dimmi",
  "old_coop",
  "buddy",
  "mucked_robot",
];

const generatedVoxelGroveNpcIds = [
  "billy",
  "sil",
  "doc",
  "rosalyn",
  "guild_clerk_nia",
  "grove_banker_merl",
  "mira_grove_land_steward",
  "gus_the_baker",
  "fern_the_grower",
  "kit_the_courier",
  "mel_the_handyman",
  "rin_the_forager",
  "carlo_the_cook",
];

ok(
  npcs.includes(
    "snapshot-grove-generated-voxel-npc-player-mesh-fallback"
  ),
  "generated voxel Grove NPC fallback renderer is versioned"
);
ok(
  npcs.indexOf("if (npcType.isPlayerLikeAppearance)") <
    npcs.indexOf("shouldUseSnapshotGroveGeneratedVoxelNpc(id, label)"),
  "player-like Grove NPCs try the player mesh path before generated voxel fallback"
);
ok(
  /snapshotGroveNpcIdFromEntityId\(id\)[\s\S]{0,220}return explicitId/.test(npcs),
  "seeded Grove ids resolve before label fallback"
);
ok(
  /makeLocalDevVoxelNpcGltf\(deps, id\)[\s\S]{0,220}snapshotGroveGeneratedVoxelNpcVersion/.test(npcs),
  "generated Grove path returns visible voxel GLTF with diagnostic metadata"
);

for (const id of assetBackedGroveNpcIds) {
  ok(assetMap.has(id), `${id} remains mapped to an authored Grove NPC asset`);
}

for (const id of generatedVoxelGroveNpcIds) {
  ok(!assetMap.has(id), `${id} intentionally has no authored asset key`);
}

for (const id of [
  "billy",
  "sil",
  "doc",
  "rosalyn",
  "guild_clerk_nia",
  "grove_banker_merl",
]) {
  ok(grove.includes(`id: "${id}"`), `${id} is in the Grove snapshot NPC table`);
}
ok(
  building.includes('id: "mira_grove_land_steward"'),
  "mira_grove_land_steward is provided by the building-system Grove NPC seed"
);
for (const id of [
  "gus_the_baker",
  "fern_the_grower",
  "kit_the_courier",
  "mel_the_handyman",
  "rin_the_forager",
  "carlo_the_cook",
]) {
  ok(economy.includes(`id: "${id}"`), `${id} is in the economy starter NPC table`);
}

for (const [label, expected] of [
  ["Billy Rhodes", "billy"],
  ["Sil", "sil"],
  ["Doc", "doc"],
  ["Rosalyn", "rosalyn"],
  ["Nia, Guild Clerk", "guild_clerk_nia"],
  ["Merl Voss, Grove Banker", "grove_banker_merl"],
  ["Mira Thatch, Grove Land Steward", "mira_grove_land_steward"],
  ["Gus the Baker", "gus_the_baker"],
  ["Fern the Grower", "fern_the_grower"],
  ["Kit the Courier", "kit_the_courier"],
  ["Mel the Handyman", "mel_the_handyman"],
  ["Rin the Forager", "rin_the_forager"],
  ["Carlo the Cook", "carlo_the_cook"],
]) {
  ok(
    npcs.includes(`return "${expected}";`),
    `${label} label fallback maps to ${expected}`
  );
}

if (failures) {
  console.error(`\n${failures} generated voxel Grove NPC check(s) failed.`);
  process.exit(1);
}
console.log("\nAll generated voxel Grove NPC renderer checks passed.");
