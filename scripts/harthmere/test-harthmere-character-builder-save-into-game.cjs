#!/usr/bin/env node
const fs = require("fs");
const path = require("path");
const root = process.argv[2] || process.cwd();
const wakePath = path.join(root, "src/client/components/WakeUpScreen.tsx");
const voxelPath = path.join(root, "src/shared/harthmere/voxel_faces.ts");
const playerMeshPath = path.join(root, "src/client/game/resources/player_mesh.ts");
function read(file) {
  if (!fs.existsSync(file)) {
    console.error(`FAIL missing ${path.relative(root, file)}`);
    process.exit(1);
  }
  return fs.readFileSync(file, "utf8");
}
function check(label, condition) {
  if (condition) {
    console.log(`OK ${label}`);
  } else {
    console.log(`FAIL ${label}`);
    failed += 1;
  }
}
function hasAll(text, values) {
  return values.every((value) => text.includes(value));
}
let failed = 0;

const wake = read(wakePath);
const voxel = read(voxelPath);
const playerMesh = read(playerMeshPath);

check("shared player clothing storage key exists", voxel.includes("HARTHMERE_PLAYER_CLOTHING_KEY_PREFIX"));
check("player clothing storage key helper exists", voxel.includes("harthmerePlayerClothingStorageKey"));
check("player clothing load/save helpers exist", hasAll(voxel, [
  "loadHarthmerePlayerClothingConfig",
  "saveHarthmerePlayerClothingConfig",
  "normalizeHarthmerePlayerClothingConfig",
]));
check("save helper uses changed-json guard to avoid noisy writes", voxel.includes("writeHarthmereJsonIfChanged(key, normalized)"));
check("save helper dispatches clothing-specific and aggregate events", voxel.includes('"biomes:harthmere-clothing-changed"') && voxel.includes('"biomes:harthmere-appearance-changed"'));
check("full player appearance loads saved clothing before gameplay", voxel.includes("const clothing = loadHarthmerePlayerClothingConfig(userId, body)") && voxel.includes("clothing,"));
check("game player mesh resource key includes clothing ids", playerMesh.includes('cl:${Object.entries(appearance.clothing)'));
check("builder initializes clothing from player/body config", wake.includes("loadHarthmerePlayerClothingConfig(") && wake.includes("loadHarthmerePlayerBodyConfig(userId)"));
check("builder reloads clothing after anonymous-to-user migration", wake.includes("setHarthmereClothing(loadHarthmerePlayerClothingConfig(userId, nextBody))"));
check("builder persists clothing whenever clothing or body changes", wake.includes("saveHarthmerePlayerClothingConfig(userId, harthmereClothing, harthmereBody)") && wake.includes("[userId, harthmereClothing, harthmereBody]"));
check("builder saves clothing synchronously before starting game", wake.includes("saveHarthmerePlayerClothingConfig(userId, harthmereClothing, harthmereBody);") && wake.includes("onComplete();"));
check("saved clothing invalidates live preview/resource key", wake.includes("clothing: Object.fromEntries") && wake.includes("key={harthmereFacePreviewKey}"));

console.log(`RESULT: ${failed === 0 ? "PASS" : "FAIL"}`);
process.exit(failed === 0 ? 0 : 1);
