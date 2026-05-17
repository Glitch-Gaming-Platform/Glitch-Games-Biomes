#!/usr/bin/env node
/* eslint-disable no-console */
const fs = require("fs");
const path = require("path");

const root = process.argv[2] || process.cwd();
const runtimePath = path.join(root, "src/client/game/renderers/local_dev/harthmere_assets.ts");
const playerMeshPath = path.join(root, "src/client/game/resources/player_mesh.ts");
const schemaPath = path.join(root, "src/shared/harthmere/voxel_faces.ts");

const runtime = fs.readFileSync(runtimePath, "utf8");
const schema = fs.readFileSync(schemaPath, "utf8");
const playerMesh = fs.existsSync(playerMeshPath) ? fs.readFileSync(playerMeshPath, "utf8") : "";

let ok = true;
function check(label, condition, detail) {
  if (condition) {
    console.log(`OK ${label}`);
  } else {
    ok = false;
    console.error(`FAIL ${label}`);
    if (detail) console.error(`     ${detail}`);
  }
}

check("NPCs keep full appearance payload", runtime.includes("root.userData.harthmereAppearance = appearance"));
check("NPCs expose body/face/clothing diagnostics", runtime.includes("harthmereRuntimeOutfitColorV17") && runtime.includes("harthmereForceProceduralTownspersonClothingKeysV13"));
check("NPCs use shared appearance factory", runtime.includes("makeHarthmereNpcAppearanceConfig") || runtime.includes("makeHarthmereNpcBodyConfig"));
check("NPC procedural path uses face renderer", runtime.includes("createHarthmereRuntimeVoxelHead(appearance"));
check("NPC procedural path uses body metrics", runtime.includes("harthmereRuntimeBodyMetrics(appearance.body)"));
check("NPC procedural path uses clothing from appearance", runtime.includes("appearance.clothing"));

if (playerMesh) {
  check("player mesh resource includes face config", playerMesh.includes("loadHarthmerePlayerFaceConfig") || playerMesh.includes("harthmereFace"));
  check("player mesh resource includes body config", playerMesh.includes("loadHarthmerePlayerBodyConfig") || playerMesh.includes("harthmereBody"));
  check("player mesh resource includes clothing config", playerMesh.includes("loadHarthmerePlayerClothingConfig") || playerMesh.includes("harthmereClothing"));
  check("player mesh resource key invalidates on appearance/clothing", playerMesh.includes("clothing") && playerMesh.includes("body") && playerMesh.includes("face"));
} else {
  console.log("SKIP player_mesh.ts not found in this checkout");
}

check("shared schema defines full face/body/clothing config", schema.includes("HarthmereVoxelFaceConfig") && schema.includes("HarthmereVoxelBodyConfig") && schema.includes("clothing"));
check("runtime forces townspersons away from GLTF prototype path", runtime.includes("if (prototype && !isProceduralTownspersonKey(placement.asset))"));

if (!ok) {
  console.error("RESULT: FAIL");
  process.exit(1);
}
console.log("RESULT: PASS");
