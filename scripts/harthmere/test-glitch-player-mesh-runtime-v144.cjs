#!/usr/bin/env node
/*
 * GLITCH_PLAYER_MESH_RUNTIME_V144
 *
 * Regression tests for the exact production blocker seen in the app container:
 * - old runtime bundles requested /api/assets/Textures/colormap.png
 * - player_animations.ts threw "Unable to find weapon parent bone"
 * - later static fallback bundles loaded the Harthmere body variant instead of
 *   the voxel wearable player mesh used by snapshot player-like characters.
 */
const fs = require("fs");
const path = require("path");

const root = path.resolve(process.argv[2] || process.cwd());
const failures = [];

function read(rel) {
  const file = path.join(root, rel);
  if (!fs.existsSync(file)) {
    failures.push(`missing ${rel}`);
    return "";
  }
  return fs.readFileSync(file, "utf8");
}

function ok(condition, message) {
  if (condition) console.log(`OK ${message}`);
  else { console.error(`FAIL ${message}`); failures.push(message); }
}

const playerAnimations = read("src/client/game/util/player_animations.ts");
const playerMesh = read("src/client/game/resources/player_mesh.ts");
const playerMeshRoute = read("src/pages/api/assets/player_mesh.glb.ts");

ok(
  playerAnimations.includes("HARTHMERE_PLAYER_MESH_MISSING_WEAPON_PARENT_NONFATAL_V144") &&
    playerAnimations.includes("weaponParentBone = mesh") &&
    !playerAnimations.includes('throw new Error("Unable to find weapon parent bone")'),
  "missing weapon parent bone is non-fatal and falls back to the visible mesh"
);

ok(
  playerMesh.includes("return ecsWearablesToUrl(wearables, appearance)") &&
    /export function ecsWearablesToUrl[\s\S]*?\/api\/assets\/player_mesh\.glb/.test(
      playerMesh
    ) &&
    !/return\s+`?\/assets\/harthmere\/gltf\/characters\/player_body_variants\/harthmere_player_average_earth\.gltf/.test(
      playerMesh
    ),
  "client bundle loads the voxel wearable /api/assets/player_mesh.glb path instead of the Harthmere static body variant"
);

ok(
  playerMesh.includes("isHarthmerePlayerBodyVariantUrl(url)") &&
    playerMesh.includes("normalizeHarthmereVariantAnimations(mesh)") &&
    playerMesh.indexOf("normalizeHarthmereVariantAnimations(mesh)") < playerMesh.indexOf("const animations = await deps.get"),
  "Harthmere variant mesh path returns before merging standard player animations"
);

ok(
  playerMeshRoute.includes('"wearables/animated_player_mesh"') &&
    playerMeshRoute.includes("assetExportsServer.build") &&
    playerMeshRoute.includes("GLITCH_STATIC_PLAYER_MESH_FALLBACK") &&
    !/GLITCH_RUNTIME[\s\S]{0,120}GLITCH_LOCAL_ASSETS[\s\S]{0,120}redirect/.test(
      playerMeshRoute
    ),
  "player_mesh API route generates the voxel wearable mesh locally and does not auto-redirect Glitch runtime to Harthmere static fallback"
);

if (failures.length) {
  console.error(`\nFAILURES: ${failures.length}`);
  for (const failure of failures) console.error(`  - ${failure}`);
  process.exit(1);
}
console.log("\nGlitch player mesh runtime v144 tests passed.");
