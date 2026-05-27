#!/usr/bin/env node
// HARTHMERE_MIXED_SCENE_TYPE_FIX_V1
// Verifies that the "Found mesh with mix of scene types: base,three.
// Defaulting to three" bug cannot recur in the Harthmere/Biomes rendering
// pipeline.
//
// Root cause (now fixed):
//   The player mesh object contains two categories of child materials:
//     • BasePassMaterial (skinned body) → sceneForMaterial returns "base"
//     • MeshToonMaterial (voxel shell from localDevBoltHeadMaterial) → "three"
//   addToScenes() in scenes.ts detected this mix and previously forced the
//   entire object into scenes.three. BasePassMaterial then rendered inside
//   the single-attachment forward framebuffer, while its fragment shader
//   wrote to three MRT layout locations → GL_INVALID_OPERATION: glDrawElements:
//   Mismatch between texture format and sampler type → completely broken
//   player bodies in production.
//
// Fix is two-part:
//   V1-A  — localDevBoltHeadMaterial in player_mesh.ts is tagged with
//            (material as any).sceneType = "base" so sceneForMaterial()
//            classifies it as "base" and the mix never arises.
//            Marker: HARTHMERE_VOXEL_SHELL_BASE_PASS_ROUTING_V1
//   V1-B  — addToScenes in scenes.ts now defaults mixed objects to "base"
//            (instead of "three") as a safety net.
//            Marker: HARTHMERE_MIXED_SCENE_TYPE_BASE_FALLBACK_V1
//
// This test checks all structural invariants that keep the fix in place:
//   1. player_mesh.ts contains the V1-A marker
//   2. (material as any).sceneType = "base" is present in localDevBoltHeadMaterial
//   3. The sceneType assignment follows the material.name assignment (correct order)
//   4. scenes.ts contains the V1-B marker
//   5. addToScenes fallback is "base", not "three"
//   6. The error log message says "Defaulting to base" (not "Defaulting to three")
//   7. BasePassMaterial extends THREE.RawShaderMaterial (unchanged — sanity check)
//   8. sceneForMaterial in scenes.ts respects the .sceneType override property
//   9. No MeshStandardMaterial / MeshPhongMaterial in player_mesh.ts that
//      could also create a mixed scene type (only MeshToonMaterial is used,
//      and it is now tagged)
//  10. The sceneType tag is on the material return value, not a global leak

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

console.log("== Harthmere mixed scene type fix v1 ==");

// ── Files exist ───────────────────────────────────────────────────────────────
check(fs.existsSync(playerMeshPath), "player_mesh.ts exists");
check(fs.existsSync(scenesPath),     "scenes.ts exists");
check(fs.existsSync(basePassPath),   "base_pass_material.ts exists");

const playerMesh = fs.readFileSync(playerMeshPath, "utf8");
const scenes     = fs.readFileSync(scenesPath,     "utf8");
const basePass   = fs.readFileSync(basePassPath,   "utf8");

// ── 1. V1-A marker is present in player_mesh.ts ───────────────────────────────
check(
  playerMesh.includes("HARTHMERE_VOXEL_SHELL_BASE_PASS_ROUTING_V1"),
  "V1-A marker HARTHMERE_VOXEL_SHELL_BASE_PASS_ROUTING_V1 present in player_mesh.ts"
);

// ── 2. sceneType="base" tag is present inside localDevBoltHeadMaterial ────────
// Extract the function body and verify the assignment is inside it.
const boltHeadMatch = playerMesh.match(
  /function localDevBoltHeadMaterial[\s\S]*?^}/m
);
check(
  boltHeadMatch !== null,
  "localDevBoltHeadMaterial function body found in player_mesh.ts"
);
if (boltHeadMatch) {
  const fnBody = boltHeadMatch[0];
  check(
    fnBody.includes('(material as any).sceneType = "base"') ||
      fnBody.includes("(material as any).sceneType = 'base'"),
    "V1-A: localDevBoltHeadMaterial sets (material as any).sceneType = \"base\""
  );
  // ── 3. sceneType assignment follows material.name (correct order) ───────────
  const nameIdx     = fnBody.indexOf("material.name");
  const sceneIdx    = fnBody.indexOf("(material as any).sceneType");
  check(
    nameIdx !== -1 && sceneIdx !== -1 && sceneIdx > nameIdx,
    "V1-A: sceneType assignment follows material.name (not before construction)"
  );
}

// ── 4. V1-B marker is present in scenes.ts ───────────────────────────────────
check(
  scenes.includes("HARTHMERE_MIXED_SCENE_TYPE_BASE_FALLBACK_V1"),
  "V1-B marker HARTHMERE_MIXED_SCENE_TYPE_BASE_FALLBACK_V1 present in scenes.ts"
);

// ── 5. addToScenes mixed fallback is "base" ───────────────────────────────────
// Locate the addToScenes function and look for the explicit assignment.
const addToScenesMatch = scenes.match(
  /export const addToScenes[\s\S]*?^};/m
);
check(
  addToScenesMatch !== null,
  "addToScenes function body found in scenes.ts"
);
if (addToScenesMatch) {
  const fn = addToScenesMatch[0];
  // The multi-branch block must NOT have `sceneName = "three"` in the
  // else-if path. We allow `let sceneName: SceneType = "three"` as the
  // initial default but the else-if override must say "base".
  const elseIfBlock = fn.match(/else if \(objScenes\.size > 1\)[\s\S]*?sceneName\s*=\s*"([^"]+)"/);
  check(
    elseIfBlock !== null && elseIfBlock[1] === "base",
    "V1-B: addToScenes mixed-type else-if block assigns sceneName = \"base\""
  );
  check(
    !fn.match(/else if \(objScenes\.size > 1\)[\s\S]*?sceneName\s*=\s*"three"/),
    "V1-B: addToScenes mixed-type else-if block does NOT fall back to \"three\""
  );
}

// ── 6. Error log message updated to "Defaulting to base" ─────────────────────
check(
  scenes.includes("Defaulting to base") && !scenes.includes("Defaulting to three"),
  "scenes.ts log message says \"Defaulting to base\" (not \"to three\")"
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

// ── 9. No untagged standard materials in player_mesh.ts ──────────────────────
// MeshStandardMaterial and MeshPhongMaterial route to "three" and have no
// sceneType override in this file — they would re-introduce the bug.
check(
  !playerMesh.includes("new THREE.MeshStandardMaterial"),
  "player_mesh.ts does not create untagged MeshStandardMaterial"
);
check(
  !playerMesh.includes("new THREE.MeshPhongMaterial"),
  "player_mesh.ts does not create untagged MeshPhongMaterial"
);

// ── 10. sceneType tag is returned from localDevBoltHeadMaterial ───────────────
// The return statement must come AFTER the sceneType assignment in the function.
if (boltHeadMatch) {
  const fnBody = boltHeadMatch[0];
  const sceneIdx  = fnBody.indexOf("(material as any).sceneType");
  const returnIdx = fnBody.lastIndexOf("return material");
  check(
    sceneIdx !== -1 && returnIdx !== -1 && returnIdx > sceneIdx,
    "V1-A: return material statement follows sceneType assignment (tag is live on returned value)"
  );
}

if (process.exitCode) {
  console.error("\nRESULT: FAIL");
  process.exit(process.exitCode);
}

console.log("\nRESULT: PASS");
