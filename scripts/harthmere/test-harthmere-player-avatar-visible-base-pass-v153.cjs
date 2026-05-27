#!/usr/bin/env node
// HARTHMERE_PLAYER_AVATAR_VISIBLE_BASE_PASS_V153
// Regression test for invisible player avatars after the mixed scene fallback
// was changed from scenes.three to scenes.base.
//
// Failure mode observed in Chrome:
//   GL_INVALID_OPERATION: glDrawArrays: Active draw buffers with missing
//   fragment shader outputs
//
// Root cause:
//   The player root contained skinned BasePassMaterial meshes plus Harthmere
//   voxel/clothing polish built from stock Three.js materials such as
//   MeshToonMaterial / MeshStandardMaterial. Sending the whole mixed root to
//   SceneBasePass put those stock materials in an MRT framebuffer even though
//   their fragment shaders only write gl_FragColor. Chrome then rejected the
//   draw and player avatars became invisible.
//
// Fix:
//   Convert every Harthmere player avatar material under the player root to a
//   generated base-pass material after face/body/clothing/equipment polish is
//   attached. Skinned meshes keep clonePlayerSkinnedMaterial(); non-skinned
//   voxel/clothing meshes use makeBasicMaterial(), whose shader writes color,
//   normal, and baseDepth.

const fs = require("fs");
const path = require("path");

function check(condition, message) {
  if (condition) {
    console.log(`OK ${message}`);
  } else {
    console.error(`FAIL ${message}`);
    process.exitCode = 1;
  }
}

const root = process.argv[2] ? path.resolve(process.argv[2]) : process.cwd();
const playerMeshPath = path.join(root, "src/client/game/resources/player_mesh.ts");
const scenesPath = path.join(root, "src/client/game/renderers/scenes.ts");
const basicFsPath = path.join(root, "src/client/game/shaders/basic.fs");
const basicMaterialJsonPath = path.join(root, "src/client/game/shaders/basic.material.json");
const sceneBasePassPath = path.join(root, "src/client/game/renderers/passes/scene_base_pass.ts");

console.log("== Harthmere player avatar visible base-pass v153 ==");

check(fs.existsSync(playerMeshPath), "player_mesh.ts exists");
check(fs.existsSync(scenesPath), "scenes.ts exists");
check(fs.existsSync(basicFsPath), "basic.fs exists");
check(fs.existsSync(basicMaterialJsonPath), "basic.material.json exists");
check(fs.existsSync(sceneBasePassPath), "scene_base_pass.ts exists");

const playerMesh = fs.readFileSync(playerMeshPath, "utf8");
const scenes = fs.readFileSync(scenesPath, "utf8");
const basicFs = fs.readFileSync(basicFsPath, "utf8");
const basicMaterialJson = fs.readFileSync(basicMaterialJsonPath, "utf8");
const sceneBasePass = fs.readFileSync(sceneBasePassPath, "utf8");

check(
  playerMesh.includes("HARTHMERE_PLAYER_AVATAR_BASE_PASS_MATERIALS_V153"),
  "V153 marker documents the invisible-avatar fix"
);
check(
  playerMesh.includes('makeBasicMaterial, updateBasicMaterial') ||
    playerMesh.includes('makeBasicMaterial') && playerMesh.includes('updateBasicMaterial'),
  "player_mesh imports makeBasicMaterial for base-pass voxel/clothing materials"
);
check(
  playerMesh.includes("function localDevBoltHeadMaterial") &&
    playerMesh.includes("makeBasicMaterial({") &&
    playerMesh.includes("harthmere-player-polished-base-pass-voxel-material"),
  "procedural face/body/clothing voxel material uses generated base-pass basic material"
);
check(
  !/function\s+localDevBoltHeadMaterial[\s\S]*?new\s+THREE\.MeshToonMaterial/.test(playerMesh),
  "procedural player voxel material no longer creates MeshToonMaterial"
);
check(
  playerMesh.includes("function coerceHarthmerePlayerObjectMaterialsToBasePass") &&
    playerMesh.includes("root.traverse") &&
    playerMesh.includes("child instanceof THREE.Mesh"),
  "player root material coercion traverses every mesh under the avatar"
);
check(
  playerMesh.includes("coerceHarthmerePlayerMaterialToBasePass(material, skinned)") &&
    playerMesh.includes("Array.isArray(child.material)"),
  "material coercion handles both single-material and multi-material meshes"
);
check(
  playerMesh.includes("if (material instanceof BasePassMaterial)") &&
    playerMesh.includes("return material"),
  "existing BasePassMaterial / player skinned materials are preserved"
);
check(
  playerMesh.includes("if (skinned)") &&
    playerMesh.includes("clonePlayerSkinnedMaterial()"),
  "non-base skinned GLB clothing is converted to skinned base-pass material"
);
check(
  playerMesh.includes("makeHarthmereNonSkinnedBasePassMaterialFromMaterial") &&
    playerMesh.includes("baseColor: harthmereMaterialColor(material)") &&
    playerMesh.includes("useMap: !!map"),
  "non-skinned GLB/Three.js clothing keeps color/map data while converting to base pass"
);
check(
  playerMesh.includes("coerceHarthmerePlayerObjectMaterialsToBasePass(playerAnimatedMesh.three)"),
  "coercion runs after Harthmere avatar polish, clothing, and equipment are attached"
);
check(
  playerMesh.indexOf("addHarthmerePlayerModularClothingRuntime") <
    playerMesh.indexOf("coerceHarthmerePlayerObjectMaterialsToBasePass(playerAnimatedMesh.three)") &&
    playerMesh.indexOf("addHarthmerePlayerAvatarFullPolishDetails") <
      playerMesh.indexOf("coerceHarthmerePlayerObjectMaterialsToBasePass(playerAnimatedMesh.three)"),
  "coercion happens after modular clothing and avatar polish create their meshes"
);
check(
  playerMesh.includes("harthmerePlayerAvatarBasePassMaterialsConverted"),
  "player root records how many materials were converted for runtime debugging"
);

check(
  scenes.includes("HARTHMERE_MIXED_SCENE_TYPE_PROD_SAFE_FALLBACK_V155"),
  "mixed scene fallback was hardened for production in V155"
);
check(
  scenes.includes("ordinary Harthmere roots containing stock") &&
    scenes.includes("do not write every active output"),
  "scenes.ts documents why stock Three.js materials cannot be sent to scenes.base"
);
check(
  scenes.includes('if (isBasePassCoercedPlayerRoot(object) && objScenes.has("base"))') &&
    scenes.includes('return "three";'),
  "mixed roots use player-only base fallback and ordinary roots stay in the three pass"
);

check(
  basicMaterialJson.includes('"material_type": "base"'),
  "basic material is generated as a base-pass material"
);
check(
  basicFs.includes("layout (location = 0) out vec4 outColor") &&
    basicFs.includes("layout (location = 1) out vec4 outNormal") &&
    basicFs.includes("layout (location = 2) out float outBaseDepth"),
  "basic.fs writes every SceneBasePass MRT output"
);
check(
  sceneBasePass.includes("new THREE.WebGLMultipleRenderTargets") &&
    sceneBasePass.includes("3,") &&
    sceneBasePass.includes('this.outputs.set("normal"') &&
    sceneBasePass.includes('this.outputs.set("baseDepth"'),
  "SceneBasePass uses 3 active draw buffers, matching the generated basic material outputs"
);
check(
  !/MeshToonMaterial[\s\S]*?sceneType\s*=\s*["']base["']/.test(playerMesh),
  "no MeshToonMaterial is mislabeled as base-pass safe"
);

if (process.exitCode) {
  console.error("\nRESULT: FAIL");
  process.exit(process.exitCode);
}
console.log("\nRESULT: PASS");
