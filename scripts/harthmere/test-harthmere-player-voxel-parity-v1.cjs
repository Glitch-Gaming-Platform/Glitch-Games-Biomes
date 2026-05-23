#!/usr/bin/env node
/* eslint-disable no-console */

// HARTHMERE_PLAYER_NPC_VOXEL_PARITY_V136
//
// Validates that the in-game player and the character builder preview render
// through the same voxel construction pipeline the NPCs use, driven by the
// shared HarthmereCharacterAppearance schema.
//
// The original bug (reproduced in image 1 of the V136 design screenshots):
//   - In-game player rendered as a featureless green block in production
//   - NPCs in the same scene rendered with full voxel face/body/clothing
//   - Character builder ("Live hero preview" + "Actual face preview") was
//     already working in dev
//
// Root cause: src/client/game/resources/player_mesh.ts had
// `process.env.NODE_ENV === "production"` early-returns in every voxel
// construction helper (body shell, face, equipment polish, avatar polish,
// sword sheath bridge). The static .gltf body variants were also missing
// from /public, so the player had nothing visible at all in production.
//
// Fix: drop the production gates so the same voxel primitives that build
// NPCs (localDevBoltHeadBox, addLocalDevPlayerVoxelFaceParts) build the
// player too, and add a graceful fallback for the missing static GLTFs.
//
// Usage: node scripts/harthmere/test-harthmere-player-voxel-parity-v1.cjs <repo-root>

const fs = require("fs");
const path = require("path");

const root = process.argv[2] || process.cwd();

const PLAYER_MESH_PATH = path.join(
  root,
  "src/client/game/resources/player_mesh.ts",
);
const NPCS_PATH = path.join(root, "src/client/game/resources/npcs.ts");
const HARTHMERE_ASSETS_PATH = path.join(
  root,
  "src/client/game/renderers/local_dev/harthmere_assets.ts",
);
const VOXEL_FACES_PATH = path.join(
  root,
  "src/shared/harthmere/voxel_faces.ts",
);
const WAKEUP_PATH = path.join(
  root,
  "src/client/components/WakeUpScreen.tsx",
);
const PREVIEW_PATH = path.join(
  root,
  "src/client/components/character/CharacterPreview.tsx",
);

function read(filePath, optional = false) {
  if (!fs.existsSync(filePath)) {
    if (optional) {
      return "";
    }
    console.error(`FAIL  required file missing: ${filePath}`);
    process.exit(1);
  }
  return fs.readFileSync(filePath, "utf8");
}

const playerMesh = read(PLAYER_MESH_PATH);
const npcs = read(NPCS_PATH);
const harthmereAssets = read(HARTHMERE_ASSETS_PATH);
const voxelFaces = read(VOXEL_FACES_PATH);
const wakeUp = read(WAKEUP_PATH, true);
const preview = read(PREVIEW_PATH, true);

let ok = true;
function check(label, condition, detail) {
  if (condition) {
    console.log(`OK    ${label}`);
  } else {
    ok = false;
    console.error(`FAIL  ${label}`);
    if (detail) {
      console.error(`      ${detail}`);
    }
  }
}

// -----------------------------------------------------------------------------
// 1. Production gates removed from player_mesh.ts
// -----------------------------------------------------------------------------

const playerMeshProductionGates = (
  playerMesh.match(/process\.env\.NODE_ENV\s*===\s*"production"/g) ?? []
).length;
check(
  "player_mesh.ts has zero `NODE_ENV === \"production\"` early-returns",
  playerMeshProductionGates === 0,
  `found ${playerMeshProductionGates} remaining; previously gated voxel ` +
    "body shell, face, polish, and sword-sheath bridge so production " +
    "players rendered as featureless blocks.",
);

const bodyShellFnIdx = playerMesh.indexOf(
  "function addLocalDevPlayerBodyShellToObject",
);
const bodyShellEndIdx = playerMesh.indexOf("\n}\n", bodyShellFnIdx);
const bodyShellBody = playerMesh.slice(bodyShellFnIdx, bodyShellEndIdx);
check(
  "addLocalDevPlayerBodyShellToObject no longer early-returns on production",
  bodyShellFnIdx > 0 &&
    !/process\.env\.NODE_ENV\s*===\s*"production"/.test(bodyShellBody),
);

const headShellFnIdx = playerMesh.indexOf(
  "function addLocalDevBoltHeadShellToObject",
);
const headShellEndIdx = playerMesh.indexOf("\n}\n", headShellFnIdx);
const headShellBody = playerMesh.slice(headShellFnIdx, headShellEndIdx);
check(
  "addLocalDevBoltHeadShellToObject no longer early-returns on production",
  headShellFnIdx > 0 &&
    !/process\.env\.NODE_ENV\s*===\s*"production"/.test(headShellBody),
);

// -----------------------------------------------------------------------------
// 2. Appearance is loaded unconditionally (not gated on NODE_ENV)
// -----------------------------------------------------------------------------

check(
  "makeAnimatedMesh loads HarthmereCharacterAppearance for ALL environments",
  /const localDevHarthmereAppearance = loadHarthmerePlayerAppearanceConfig\(id\);/
    .test(playerMesh),
  "appearance must drive the voxel face/body/clothing in production too.",
);

check(
  "makeAnimatedMesh does not gate appearance load on NODE_ENV !== production",
  !/localDevHarthmereAppearance\s*=\s*\n?\s*process\.env\.NODE_ENV\s*!==\s*"production"/
    .test(playerMesh),
);

// -----------------------------------------------------------------------------
// 3. Both pipelines share the same voxel primitives and appearance schema
// -----------------------------------------------------------------------------

check(
  "player_mesh.ts builds the player with localDevBoltHeadBox primitives",
  /localDevBoltHeadBox\(/.test(playerMesh),
);

check(
  "player_mesh.ts builds the voxel face with addLocalDevPlayerVoxelFaceParts",
  /addLocalDevPlayerVoxelFaceParts\(/.test(playerMesh),
);

check(
  "NPC runtime renderer builds NPCs with createHarthmereRuntimeVoxelHead",
  /createHarthmereRuntimeVoxelHead\(/.test(harthmereAssets),
);

check(
  "NPC runtime renderer builds NPCs with harthmereRuntimeBodyMetrics",
  /harthmereRuntimeBodyMetrics\(/.test(harthmereAssets),
);

check(
  "NPC runtime renderer reads the same HarthmereCharacterAppearance schema",
  /HarthmereCharacterAppearance/.test(harthmereAssets) &&
    /appearance\.clothing/.test(harthmereAssets) &&
    /appearance\.body/.test(harthmereAssets),
);

check(
  "ECS NPC factory (npcs.ts) uses makeLocalDevVoxelNpcGltf for voxel parity",
  /makeLocalDevVoxelNpcGltf\(/.test(npcs),
);

check(
  "shared voxel_faces.ts defines the HarthmereCharacterAppearance schema",
  /HarthmereCharacterAppearance/.test(voxelFaces) &&
    /HarthmereVoxelFaceConfig/.test(voxelFaces) &&
    /HarthmereVoxelBodyConfig/.test(voxelFaces),
);

check(
  "shared voxel_faces.ts exports builder-field lists used by the character builder",
  /HARTHMERE_APPEARANCE_BUILDER_FACE_FIELDS/.test(voxelFaces) &&
    /HARTHMERE_APPEARANCE_BUILDER_BODY_FIELDS/.test(voxelFaces),
);

// -----------------------------------------------------------------------------
// 4. The character builder writes the same appearance the renderer reads
// -----------------------------------------------------------------------------

if (wakeUp) {
  check(
    "WakeUpScreen.tsx imports the shared builder field lists",
    /HARTHMERE_APPEARANCE_BUILDER_(FACE|BODY)_FIELDS/.test(wakeUp),
    "Builder fields must come from voxel_faces.ts so face/body sliders " +
      "drive the same appearance object the renderer consumes.",
  );

  check(
    "WakeUpScreen.tsx renders the live hero preview",
    /Live hero preview|live hero preview|harthmere.*Preview|HarthmerePlayerPreview/i
      .test(wakeUp),
  );
} else {
  console.log("SKIP  WakeUpScreen.tsx not present in this checkout");
}

if (preview) {
  check(
    "CharacterPreview.tsx uses the same player mesh path the in-game player uses",
    /\/scene\/player\/mesh_preview|makePlayerPreviewMesh|player_mesh/.test(preview),
    "If the builder used a separate mesh path, the in-game player and the " +
      "preview would drift visually — the V136 fix relies on a single path.",
  );
} else {
  console.log("SKIP  CharacterPreview.tsx not present in this checkout");
}

// -----------------------------------------------------------------------------
// 5. Static GLTF fallback for missing player_body_variants/*.gltf files
// -----------------------------------------------------------------------------

check(
  "player_mesh.ts has a fallback builder for missing static variant GLTFs",
  /buildHarthmereVariantFallbackGltf/.test(playerMesh),
  "The /public/assets/harthmere/gltf/characters/player_body_variants/*.gltf " +
    "files do not ship — without a fallback, loadGltf throws and the player " +
    "renders nothing.",
);

check(
  "player_mesh.ts wraps the variant load in try/catch with the fallback",
  /try\s*\{\s*mesh\s*=\s*await\s*loadGltf\(url\);\s*\}\s*catch[^}]*buildHarthmereVariantFallbackGltf/
    .test(playerMesh),
);

check(
  "fallback satisfies loadPlayerAnimatedMesh by including a Mesh + weapon bone",
  /harthmere-variant-fallback-placeholder-mesh/.test(playerMesh) &&
    /weaponParentBone\.name\s*=\s*"(RightHand|R_Arm|RightArm|Equipped_Attach)"/
      .test(playerMesh),
);

check(
  "fallback ships animation clips from /scene/player/animations",
  /animationsGltf\.animations\.map\(\(clip\)\s*=>\s*clip\.clone\(\)\)/.test(
    playerMesh,
  ),
);

// -----------------------------------------------------------------------------
// 6. Version marker for observability
// -----------------------------------------------------------------------------

check(
  "player_mesh.ts stamps the V136 version marker on the player mesh",
  /HARTHMERE_PLAYER_NPC_VOXEL_PARITY_V136/.test(playerMesh) &&
    /harthmerePlayerNpcVoxelParityVersionV136/.test(playerMesh),
);

// -----------------------------------------------------------------------------

if (!ok) {
  console.error("");
  console.error("RESULT: FAIL");
  process.exit(1);
}
console.log("");
console.log("RESULT: PASS");
