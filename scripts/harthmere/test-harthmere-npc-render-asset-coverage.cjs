#!/usr/bin/env node
/* eslint-disable no-console */

// HARTHMERE_NPC_RENDER_ASSET_COVERAGE
// Static asset-map coverage for NPC visibility. This does not prove browser
// pixels, but it catches missing model/icon/item/audio assets and renderer paths
// that would leave nameplates with invisible NPC bodies.
const fs = require("fs");
const path = require("path");

const root = path.resolve(process.argv[2] || process.cwd());
const failures = [];
function read(rel) {
  const full = path.join(root, rel);
  if (!fs.existsSync(full)) {
    failures.push(`missing ${rel}`);
    return "";
  }
  return fs.readFileSync(full, "utf8");
}
function ok(label, condition, detail = "") {
  if (condition) console.log(`OK    ${label}`);
  else {
    console.error(`FAIL  ${label}`);
    if (detail) console.error(`      ${detail}`);
    failures.push(label);
  }
}
function assetPathLooksRenderable(assetPath) {
  return typeof assetPath === "string" && /^asset_data\//.test(assetPath) && /\.[0-9a-f]{16,}\.[a-z0-9]+$/i.test(assetPath);
}

const assetJsonPath = path.join(root, "src/galois/js/interface/gen/asset_versions.json");
const assetVersions = JSON.parse(fs.readFileSync(assetJsonPath, "utf8"));
const paths = assetVersions.paths || {};
const npcResources = read("src/client/game/resources/npcs.ts");
const playerMesh = read("src/client/game/resources/player_mesh.ts");
const renderer = read("src/client/game/renderers/npcs.ts");

const npcKeys = Object.keys(paths).filter((k) => k.startsWith("npcs/")).sort();
ok("asset map contains many NPC model entries", npcKeys.length >= 40, `count=${npcKeys.length}`);

const missingNpcModels = npcKeys.filter((k) => !assetPathLooksRenderable(paths[k]));
ok("all NPC model asset paths point to versioned asset_data files", missingNpcModels.length === 0, missingNpcModels.join(", "));

const missingIcons = npcKeys
  .map((k) => k.slice("npcs/".length))
  .filter((name) => !assetPathLooksRenderable(paths[`icons/npcs/${name}`]));
ok("all NPC models have icon assets", missingIcons.length === 0, missingIcons.join(", "));

const combatNpcNames = [
  "big_mucker",
  "cobble_mucker",
  "dragon_mucker",
  "jugger_mucker",
  "mossy_mucker",
  "sappy_mucker",
  "seedy_muckling",
  "stone_mucker",
  "tree_mucker",
  "brown_hexer",
  "purple_hexer",
];
for (const name of combatNpcNames) {
  ok(`combat NPC ${name} has model`, assetPathLooksRenderable(paths[`npcs/${name}`]));
  ok(`combat NPC ${name} has icon`, assetPathLooksRenderable(paths[`icons/npcs/${name}`]));
  ok(`combat NPC ${name} has item mesh`, assetPathLooksRenderable(paths[`item_meshes/npcs/${name}`]));
}

for (const key of [
  "audio/npc-mucker-on-attack-1",
  "audio/npc-mucker-on-hit-1",
  "audio/npc-mucker-on-death-1",
  "audio/npc-muckling-on-attack-1",
  "audio/npc-muckling-on-hit-1",
  "audio/npc-muckling-on-death-1",
]) {
  ok(`${key} exists`, assetPathLooksRenderable(paths[key]));
}

for (const animal of ["bird", "cat", "chicken", "cow", "dog_1", "duck", "fish", "mouse", "rabbit", "sheep", "turtle"]) {
  ok(`animal NPC ${animal} has model`, assetPathLooksRenderable(paths[`npcs/${animal}`]));
  ok(`animal NPC ${animal} has icon`, assetPathLooksRenderable(paths[`icons/npcs/${animal}`]));
}

for (const grove of ["jackie", "ranger_jane", "alexis", "luis", "taye", "sil", "dimmi", "doc", "buddy", "oldCoop", "mucked_robot"]) {
  ok(`snapshot Grove NPC ${grove} has model`, assetPathLooksRenderable(paths[`npcs/${grove}`]));
  ok(`snapshot Grove NPC ${grove} has icon`, assetPathLooksRenderable(paths[`icons/npcs/${grove}`]));
}

ok("wearable animations GLB exists for player/player-like NPCs", assetPathLooksRenderable(paths["wearables/animations"]));
ok("player-like NPC generated path uses /api/assets/player_mesh.glb", /makeSnapshotPlayerLikeAppearanceMesh[\s\S]*fetchPlayerMeshGLTF[\s\S]*mesh\.scene\.userData\.snapshotRichNpcAppearanceVersion/m.test(playerMesh));
ok("NPC resource has generated player-like visible path", /makeSnapshotPlayerLikeAppearanceMesh\(deps, id\)/.test(npcResources));
ok("NPC resource does not replace failed player-like Grove avatars with the Harthmere voxel body", !/HARTHMERE_NPC_RENDER_PARITY[\s\S]*falling back to visible voxel NPC/m.test(npcResources));
ok("NPC resource has visible fallback for failed galois mesh", /HARTHMERE_NPC_GALOIS_VISIBLE_FALLBACK[\s\S]*makeLocalDevVoxelNpcGltf\(deps, id\)/m.test(npcResources));
ok("NPC renderer only increments rendered count after render state exists", /const renderState = resources\.cached\([\s\S]*?if \(!renderState\)[\s\S]*?continue;[\s\S]*?\+\+numNpcsRenderedCval\.value/m.test(renderer));

if (failures.length) {
  console.error(`\nRESULT: FAIL (${failures.length} failure(s))`);
  process.exit(1);
}
console.log("\nRESULT: PASS");
