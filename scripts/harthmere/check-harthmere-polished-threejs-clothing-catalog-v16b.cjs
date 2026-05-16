#!/usr/bin/env node
const fs = require("fs");
const path = require("path");

const root = process.argv[2] || process.cwd();
const facesPath = path.join(root, "src/shared/harthmere/voxel_faces.ts");
const playerPath = path.join(root, "src/client/game/resources/player_mesh.ts");

function check(name, ok) {
  if (!ok) {
    console.error(`FAIL ${name}`);
    process.exitCode = 1;
  } else {
    console.log(`OK ${name}`);
  }
}

const faces = fs.readFileSync(facesPath, "utf8");
const player = fs.readFileSync(playerPath, "utf8");

check("faces file exists", fs.existsSync(facesPath));
check("player file exists", fs.existsSync(playerPath));
check(
  "normalize appearance declaration is not duplicated",
  !/normalizeHarthmereCharacterAppearance\(\s*export\s+function\s+normalizeHarthmereCharacterAppearance\(/.test(faces)
);
check(
  "skinned mesh finder declaration is not duplicated",
  !/harthmereFindFirstSkinnedMesh\(\s*function\s+harthmereFindFirstSkinnedMesh\(/.test(player)
);
check(
  "normalize appearance function still exists",
  /export function normalizeHarthmereCharacterAppearance\(\s*value: HarthmereCharacterAppearanceInput \| undefined,/.test(faces)
);
check(
  "skinned mesh finder function still exists",
  /function harthmereFindFirstSkinnedMesh\(root: THREE\.Object3D\): THREE\.SkinnedMesh \| undefined \{/.test(player)
);
check(
  "v16 catalog still exists",
  /HARTHMERE_THREEJS_CLOTHING_CATALOG_VERSION/.test(faces)
);
check(
  "v16 player renderer still exists",
  /harthmere-threejs-clothing-v16-polished-catalog-body-fit/.test(player)
);

if (process.exitCode) {
  console.error("\nRESULT: FAIL");
  process.exit(process.exitCode);
}
console.log("\nRESULT: PASS");
