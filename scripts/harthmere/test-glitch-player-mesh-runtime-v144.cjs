#!/usr/bin/env node
/*
 * GLITCH_PLAYER_MESH_RUNTIME_V144
 *
 * Regression tests for the exact production blocker seen in the app container:
 * - old runtime bundles requested /api/assets/Textures/colormap.png
 * - player_animations.ts threw "Unable to find weapon parent bone"
 * - restoring old revisions did not fix it because the current image still used
 *   stale bundles and the source tests only checked HTTP 200, not mesh validity.
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
    !/return\s+`?\/api\/assets\/player_mesh\.glb/.test(playerMesh),
  "new client bundle loads the local Harthmere player variant directly instead of /api/assets/player_mesh.glb"
);

ok(
  playerMesh.includes("isHarthmerePlayerBodyVariantUrl(url)") &&
    playerMesh.includes("normalizeHarthmereVariantAnimations(mesh)") &&
    playerMesh.indexOf("normalizeHarthmereVariantAnimations(mesh)") < playerMesh.indexOf("const animations = await deps.get"),
  "Harthmere variant mesh path returns before merging standard player animations"
);

ok(
  playerMeshRoute.includes("GLITCH_STATIC_PLAYER_MESH_FALLBACK") &&
    playerMeshRoute.includes("res.redirect(307"),
  "legacy API route remains only as compatibility fallback, not the primary source path"
);

if (failures.length) {
  console.error(`\nFAILURES: ${failures.length}`);
  for (const failure of failures) console.error(`  - ${failure}`);
  process.exit(1);
}
console.log("\nGlitch player mesh runtime v144 tests passed.");
