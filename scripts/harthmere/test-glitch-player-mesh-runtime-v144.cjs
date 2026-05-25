#!/usr/bin/env node
/*
 * GLITCH_PLAYER_MESH_RUNTIME_V144
 *
 * Regression tests for the exact production blocker seen in the app container:
 * - old runtime bundles requested /api/assets/Textures/colormap.png
 * - player_animations.ts threw "Unable to find weapon parent bone"
 * - Glitch production should use the packaged player body variant directly
 *   instead of starting the unavailable Python asset builder and logging errors.
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
const assetServer = read("src/galois/js/server/server.ts");
const dockerfile = read("Dockerfile.biomes");

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
    playerMeshRoute.includes("shouldUseStaticPlayerMeshFallback") &&
    playerMeshRoute.includes("Using packaged player body mesh fallback for Glitch runtime") &&
    playerMeshRoute.includes('process.env.GLITCH_RUNTIME === "1"') &&
    playerMeshRoute.includes("Galois player mesh asset build returned an error") &&
    playerMeshRoute.indexOf("shouldUseStaticPlayerMeshFallback") <
      playerMeshRoute.indexOf("fetchOrComputeMesh"),
  "player_mesh API route uses packaged player body fallback before starting unavailable Glitch production generation"
);

ok(
  !dockerfile.includes("voxeloo-wheel") &&
    !dockerfile.includes("bazelisk") &&
    !dockerfile.includes("python -m pip wheel --no-cache-dir --no-deps"),
  "production image avoids native voxeloo build tooling and relies on packaged player mesh fallback"
);

ok(
  assetServer.includes("Galois asset server process exited") &&
    assetServer.includes("Galois asset server pipe error") &&
    assetServer.includes("child.once(\"exit\", handleExit)") &&
    assetServer.includes("output.once(\"error\", handleError)"),
  "Galois asset worker failures reject the request instead of crashing web"
);

if (failures.length) {
  console.error(`\nFAILURES: ${failures.length}`);
  for (const failure of failures) console.error(`  - ${failure}`);
  process.exit(1);
}
console.log("\nGlitch player mesh runtime v144 tests passed.");
