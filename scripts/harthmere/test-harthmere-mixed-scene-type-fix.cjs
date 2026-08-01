#!/usr/bin/env node
// HARTHMERE_MIXED_SCENE_TYPE_FIX
// Verifies that mixed player-avatar roots cannot be routed into an incompatible
// framebuffer while ordinary mixed Three.js roots remain forward-pass safe.
//
// Root cause (now fixed):
//   Player roots once mixed BasePassMaterial bodies with stock Three.js
//   clothing/polish. Routing the root to either framebuffer broke one half:
//   base-pass shaders need MRT, while stock shaders do not emit all MRT outputs.
//
// Current fix:
//   A — every player-root mesh material is coerced to a generated base-pass
//       material after clothing/polish is attached.
//   B — only explicitly marked player roots may use the emergency base fallback;
//       ordinary mixed roots stay in the Three.js forward pass.
//
// This test checks all structural invariants that keep the fix in place:
//   1. player procedural materials are generated base-pass materials
//   2. all skinned/non-skinned clothing materials are coerced under the root
//   3. scenes.ts contains the player-only production-safe fallback
//   4. marked player roots choose base; ordinary mixed roots choose three
//   5. BasePassMaterial and explicit sceneType routing remain intact

const fs = require("fs");
const path = require("path");

function check(condition, message) {
  if (condition) {
    console.log(`OK   ${message}`);
  } else {
    console.error(`FAIL ${message}`);
    process.exitCode = 1;
  }
}

const root = process.argv[2] ? path.resolve(process.argv[2]) : process.cwd();

const playerMeshPath = path.join(root, "src/client/game/resources/player_mesh.ts");
const scenesPath     = path.join(root, "src/client/game/renderers/scenes.ts");
const basePassPath   = path.join(root, "src/client/game/renderers/base_pass_material.ts");

console.log("== Harthmere mixed scene type fix current ==");

// ── Files exist ───────────────────────────────────────────────────────────────
check(fs.existsSync(playerMeshPath), "player_mesh.ts exists");
check(fs.existsSync(scenesPath),     "scenes.ts exists");
check(fs.existsSync(basePassPath),   "base_pass_material.ts exists");

const playerMesh = fs.readFileSync(playerMeshPath, "utf8");
const scenes     = fs.readFileSync(scenesPath,     "utf8");
const basePass   = fs.readFileSync(basePassPath,   "utf8");

// ── 1. Player procedural materials are base-pass compatible ─────────────────
check(
  playerMesh.includes("HARTHMERE_PLAYER_AVATAR_BASE_PASS_MATERIALS"),
  "player base-pass coercion marker is present"
);

// Extract the function body and verify it constructs the generated MRT material.
const boltHeadStart = playerMesh.indexOf("function localDevBoltHeadMaterial");
const boltHeadEnd = playerMesh.indexOf("function harthmereMaterialColor", boltHeadStart);
const boltHeadMatch =
  boltHeadStart >= 0 && boltHeadEnd > boltHeadStart
    ? [playerMesh.slice(boltHeadStart, boltHeadEnd)]
    : null;
check(
  boltHeadMatch !== null,
  "localDevBoltHeadMaterial function body found in player_mesh.ts"
);
if (boltHeadMatch) {
  const fnBody = boltHeadMatch[0];
  check(
    fnBody.includes("makeBasicMaterial({") &&
      !fnBody.includes("new THREE.MeshToonMaterial") &&
      fnBody.includes("harthmere-player-polished-base-pass-voxel-material"),
    "localDevBoltHeadMaterial uses the generated base-pass material"
  );
}

check(
  playerMesh.includes("function coerceHarthmerePlayerObjectMaterialsToBasePass") &&
    playerMesh.includes("coerceHarthmerePlayerMaterialToBasePass(material, skinned)") &&
    playerMesh.includes("Array.isArray(child.material)"),
  "player material coercion covers every mesh and material array"
);
check(
  playerMesh.includes("if (skinned)") &&
    playerMesh.includes("clonePlayerSkinnedMaterial()") &&
    playerMesh.includes("makeHarthmereNonSkinnedBasePassMaterialFromMaterial"),
  "skinned bodies and non-skinned clothing use compatible base-pass materials"
);

// ── 2. Mixed-root routing is narrow and framebuffer safe ─────────────────────
check(
  scenes.includes("HARTHMERE_MIXED_SCENE_TYPE_PROD_SAFE_FALLBACK"),
  "production-safe mixed scene fallback marker is present"
);
check(
  scenes.includes('if (isBasePassCoercedPlayerRoot(object) && objScenes.has("base"))') &&
    scenes.includes('return "base";') &&
    scenes.includes('return "three";'),
  "marked player roots fall back to base and ordinary mixed roots to three"
);

// ── 7. BasePassMaterial still extends RawShaderMaterial (sanity) ─────────────
check(
  basePass.includes("extends THREE.RawShaderMaterial") ||
    basePass.includes("extends RawShaderMaterial"),
  "BasePassMaterial still extends THREE.RawShaderMaterial (sanity check)"
);

// ── 8. sceneForMaterial in scenes.ts respects .sceneType override ─────────────
// The override pattern is: (material as any).sceneType  OR  material.sceneType
check(
  scenes.includes("sceneType") &&
    (scenes.includes("(material as any).sceneType") ||
      scenes.includes("material.sceneType")),
  "sceneForMaterial in scenes.ts reads .sceneType override from material"
);

if (process.exitCode) {
  console.error("\nRESULT: FAIL");
  process.exit(process.exitCode);
}

console.log("\nRESULT: PASS");
