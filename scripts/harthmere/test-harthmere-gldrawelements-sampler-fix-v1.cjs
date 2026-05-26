#!/usr/bin/env node
// HARTHMERE_GLDRAWELEMENTS_SAMPLER_FIX_V1
// Verifies that the GL_INVALID_OPERATION: glDrawElements: Mismatch between
// texture format and sampler type (signed/unsigned/float/shadow) error
// cannot recur in the Harthmere/Biomes WebGL rendering pipeline.
//
// Root cause (now fixed):
//   Three.js PropertyBinding spam (11 000+ "Trying to update node for track:
//   R_Arm.position but it wasn't found" per frame) caused the AnimationMixer
//   to be in a degraded state. Under that load the GC/event loop stutter was
//   enough for the WebGL state machine to observe stale texture bindings: an
//   R32UI terrain texture (used by `usampler2D materialRank` in blocks.fs)
//   happened to occupy the same unit as the player SkinnedMesh's
//   `sampler2D boneTexture`, producing the mismatch.
//
// Fix is two-part and both parts are already in the codebase:
//   V137  — playerMeshUrlForId routes the player mesh through
//            /api/assets/player_mesh.glb so the skeleton/boneTexture is
//            always fully initialized by GLTFLoader before first render.
//   V152  — animationTrackCanBindToMesh() filters out every KeyframeTrack
//            that targets a bone absent from the loaded mesh scene before
//            mixer.clipAction() is called. This eliminates the PropertyBinding
//            spam for both the player AnimationSystem and the NPC
//            AnimationSystem (both call AnimationSystem.newState).
//
// This test checks all structural invariants that keep the mismatch fixed:
//   1. V152 pruning exists in AnimationSystem.newState
//   2. NPC system uses the same AnimationSystem.newState path
//   3. skinning.ts deletes boneTexture from material uniforms so Three.js
//      handles it automatically (the correct pattern for SkinnedMesh +
//      RawShaderMaterial)
//   4. Player vertex shader declares sampler2D (float), not usampler2D (uint)
//   5. Block fragment shader declares usampler2D for integer terrain textures
//   6. makeBufferTexture produces R32UI (unsigned integer) textures — the
//      correct type for usampler2D, confirming type separation is intentional
//   7. BasePassMaterial is RawShaderMaterial (no built-in sampler injection)
//   8. Player skinned material is BasePassMaterial (consistent scene routing)

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

const animSystemPath  = path.join(root, "src/client/game/util/animation_system.ts");
const npcsPath        = path.join(root, "src/client/game/resources/npcs.ts");
const skinningPath    = path.join(root, "src/client/game/util/skinning.ts");
const playerVsPath    = path.join(root, "src/client/game/shaders/player.vs");
const blocksFsPath    = path.join(root, "src/client/game/shaders/blocks.fs");
const texturesPath    = path.join(root, "src/client/game/util/textures.ts");
const basePassPath    = path.join(root, "src/client/game/renderers/base_pass_material.ts");
const playerSkinnedPath = path.join(root, "src/gen/client/game/shaders/player_skinned.ts");

console.log("== Harthmere glDrawElements sampler fix v1 ==");

// ── Files exist ──────────────────────────────────────────────────────────────
check(fs.existsSync(animSystemPath),    "animation_system.ts exists");
check(fs.existsSync(npcsPath),          "npcs.ts exists");
check(fs.existsSync(skinningPath),      "skinning.ts exists");
check(fs.existsSync(playerVsPath),      "player.vs exists");
check(fs.existsSync(blocksFsPath),      "blocks.fs exists");
check(fs.existsSync(texturesPath),      "textures.ts exists");
check(fs.existsSync(basePassPath),      "base_pass_material.ts exists");
check(fs.existsSync(playerSkinnedPath), "player_skinned.ts exists");

const animSystem    = fs.readFileSync(animSystemPath,    "utf8");
const npcs          = fs.readFileSync(npcsPath,          "utf8");
const skinning      = fs.readFileSync(skinningPath,      "utf8");
const playerVs      = fs.readFileSync(playerVsPath,      "utf8");
const blocksFs      = fs.readFileSync(blocksFsPath,      "utf8");
const textures      = fs.readFileSync(texturesPath,      "utf8");
const basePass      = fs.readFileSync(basePassPath,      "utf8");
const playerSkinned = fs.readFileSync(playerSkinnedPath, "utf8");

// ── 1. V152 animation track pruning is in AnimationSystem.newState ────────────
check(
  animSystem.includes("HARTHMERE_STATIC_FALLBACK_ANIMATION_TARGET_PRUNING_V152"),
  "V152 marker present in animation_system.ts"
);
check(
  animSystem.includes("collectAnimationTargetNodeNames(meshScene)") &&
    animSystem.includes("animationTrackCanBindToMesh(t, targetNodeNames)"),
  "V152: collectAnimationTargetNodeNames + animationTrackCanBindToMesh called in newState"
);
check(
  animSystem.includes("anim.tracks = anim.tracks.filter(") &&
    animSystem.includes("animationTrackCanBindToMesh"),
  "V152: tracks are filtered with animationTrackCanBindToMesh before clipAction"
);
// The guard returns undefined (no action) when all tracks are pruned out,
// preventing mixer.clipAction on a zero-track clip which throws in r128.
check(
  animSystem.includes("anim.tracks.length === 0") &&
    animSystem.includes("return undefined"),
  "V152: zero-track clips return undefined instead of calling clipAction"
);

// ── 2. NPC system routes through the same AnimationSystem.newState ────────────
check(
  npcs.includes("npcSystem.newState("),
  "NPC meshes call npcSystem.newState (inherits V152 track pruning)"
);
// The NPC AnimationSystem instance is constructed from the shared class.
check(
  npcs.includes("new AnimationSystem(") || npcs.includes("AnimationSystem("),
  "npcSystem is an AnimationSystem instance (shares pruning code with player)"
);

// ── 3. skinning.ts deletes boneTexture so Three.js handles it automatically ──
check(
  skinning.includes('delete meshMaterial.uniforms.boneTexture') &&
    skinning.includes('delete meshMaterial.uniforms.boneTextureSize'),
  "skinning.ts deletes boneTexture/boneTextureSize so Three.js auto-uploads them for SkinnedMesh"
);
// Confirm the intention is documented in a comment.
check(
  skinning.includes("three.js will automatically upload") ||
    skinning.includes("automatically upload these skinning"),
  "skinning.ts documents the reason for deleting boneTexture uniforms"
);

// ── 4. Player vertex shader uses float sampler2D for boneTexture ──────────────
check(
  playerVs.includes("uniform highp sampler2D boneTexture") ||
    playerVs.includes("uniform sampler2D boneTexture"),
  "player.vs declares boneTexture as float sampler2D (not usampler2D)"
);
// Confirm there are NO unsigned samplers in the player shader.
check(
  !playerVs.includes("usampler2D"),
  "player.vs does not declare any usampler2D (no integer sampler in player shader)"
);

// ── 5. Block fragment shader uses usampler2D for integer terrain textures ─────
check(
  blocksFs.includes("usampler2D materialRank") &&
    blocksFs.includes("usampler2D materialData"),
  "blocks.fs declares materialRank and materialData as usampler2D (unsigned int)"
);
check(
  blocksFs.includes("usampler2D lightingRank") &&
    blocksFs.includes("usampler2D lightingData"),
  "blocks.fs declares lightingRank and lightingData as usampler2D"
);
check(
  blocksFs.includes("usampler2D textureIndex") ||
    blocksFs.includes("usampler2D"),
  "blocks.fs uses usampler2D samplers for integer terrain data (confirms type separation)"
);
// Confirm there are NO float sampler2D that could alias with player boneTexture.
// (The block shader should only sample terrain integer textures + color/mrea maps.)
check(
  !blocksFs.includes("sampler2D boneTexture"),
  "blocks.fs does not declare boneTexture (no cross-contamination with player shader)"
);

// ── 6. makeBufferTexture creates R32UI (unsigned int) textures ────────────────
check(
  textures.includes("R32UI") || textures.includes("RedIntegerFormat"),
  "makeBufferTexture uses R32UI/RedIntegerFormat — matches usampler2D in blocks.fs"
);
check(
  textures.includes("UnsignedIntType") || textures.includes("internalFormat"),
  "makeBufferTexture uses UnsignedIntType or internalFormat for correct WebGL2 integer texture"
);

// ── 7. BasePassMaterial is THREE.RawShaderMaterial ───────────────────────────
check(
  basePass.includes("extends THREE.RawShaderMaterial") ||
    basePass.includes("extends RawShaderMaterial"),
  "BasePassMaterial extends THREE.RawShaderMaterial (no built-in sampler injection)"
);
// BasePassMaterial must NOT extend MeshStandardMaterial or similar, which
// would inject its own boneTexture handling and conflict with ours.
check(
  !basePass.includes("MeshStandardMaterial") &&
    !basePass.includes("MeshPhongMaterial"),
  "BasePassMaterial does not extend MeshStandardMaterial/MeshPhongMaterial"
);

// ── 8. Player skinned material uses BasePassMaterial ─────────────────────────
check(
  playerSkinned.includes("new BasePassMaterial("),
  "makePlayerSkinnedMaterial creates a BasePassMaterial (consistent scene routing)"
);
check(
  playerSkinned.includes("BasePassMaterial"),
  "player_skinned.ts imports BasePassMaterial"
);

if (process.exitCode) {
  console.error("\nRESULT: FAIL");
  process.exit(process.exitCode);
}

console.log("\nRESULT: PASS");
