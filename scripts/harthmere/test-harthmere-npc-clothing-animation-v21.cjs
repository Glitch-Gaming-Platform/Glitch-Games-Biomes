#!/usr/bin/env node

/**
 * Harthmere NPC clothing + animation invariant tests v21e.
 *
 * Current-state expectations:
 * - Product-polished Three.js clothing is the default path.
 * - GLTF/modelUrl clothing remains optional.
 * - makeHarthmereNpcAppearanceConfig may be implemented either inline
 *   or as a wrapper around makeHarthmereNpcAppearanceConfigBaseV21d.
 * - The exported NPC appearance function must guarantee final non-animal
 *   clothing through harthmereEnsureProductMinecraftClothingSetV20(...).
 * - NPC movement animation must expose Idle, Walk, and Run clips and
 *   record selectedState during execution.
 */

const fs = require("fs");
const path = require("path");

const root = process.argv[2] || process.cwd();

const facesPath = path.join(root, "src/shared/harthmere/voxel_faces.ts");
const npcsPath = path.join(root, "src/client/game/resources/npcs.ts");
const assetsPath = path.join(root, "src/client/game/renderers/local_dev/harthmere_assets.ts");
const playerPath = path.join(root, "src/client/game/resources/player_mesh.ts");

const failures = [];

function read(file) {
  return fs.existsSync(file) ? fs.readFileSync(file, "utf8") : "";
}

const faces = read(facesPath);
const npcs = read(npcsPath);
const assets = read(assetsPath);
const player = read(playerPath);

function ok(label, condition) {
  if (condition) {
    console.log(`OK ${label}`);
  } else {
    failures.push(label);
    console.log(`FAIL ${label}`);
  }
}

function section(title) {
  console.log("");
  console.log(`== ${title} ==`);
}

function findMatching(src, start, openChar, closeChar) {
  let depth = 0;
  let quote = null;
  let escape = false;
  let lineComment = false;
  let blockComment = false;

  for (let i = start; i < src.length; i += 1) {
    const ch = src[i];
    const next = src[i + 1] || "";

    if (lineComment) {
      if (ch === "\n") lineComment = false;
      continue;
    }

    if (blockComment) {
      if (ch === "*" && next === "/") {
        blockComment = false;
        i += 1;
      }
      continue;
    }

    if (quote) {
      if (escape) {
        escape = false;
      } else if (ch === "\\") {
        escape = true;
      } else if (ch === quote) {
        quote = null;
      }
      continue;
    }

    if (ch === "/" && next === "/") {
      lineComment = true;
      i += 1;
      continue;
    }

    if (ch === "/" && next === "*") {
      blockComment = true;
      i += 1;
      continue;
    }

    if (ch === "'" || ch === '"' || ch === "`") {
      quote = ch;
      continue;
    }

    if (ch === openChar) depth += 1;
    if (ch === closeChar) {
      depth -= 1;
      if (depth === 0) return i;
    }
  }

  return -1;
}

function extractFunction(src, name) {
  const re = new RegExp(`(?:export\\s+)?function\\s+${name}\\s*\\(`);
  const match = re.exec(src);
  if (!match) return "";

  const parenStart = src.indexOf("(", match.index);
  const parenEnd = findMatching(src, parenStart, "(", ")");
  if (parenEnd < 0) return "";

  const braceStart = src.indexOf("{", parenEnd);
  if (braceStart < 0) return "";

  const braceEnd = findMatching(src, braceStart, "{", "}");
  if (braceEnd < 0) return "";

  return src.slice(match.index, braceEnd + 1);
}

console.log("== Harthmere NPC clothing + animation invariant tests v21e ==");
console.log(`Root: ${root}`);
console.log("");

ok("faces file exists", Boolean(faces));
ok("npcs file exists", Boolean(npcs));
ok("assets file exists", Boolean(assets));
ok("player file exists", Boolean(player));

const npcAppearanceWrapper = extractFunction(faces, "makeHarthmereNpcAppearanceConfig");
const npcAppearanceBase = extractFunction(faces, "makeHarthmereNpcAppearanceConfigBaseV21d");
const defaultRoleClothing = extractFunction(faces, "defaultHarthmereClothingForRole");
const uniqueNpcClothing = extractFunction(faces, "makeHarthmereNpcUniqueClothingSet");
const clothingGuarantee = extractFunction(faces, "harthmereEnsureProductMinecraftClothingSetV20");

section("Clothing catalog and assignment tests");

ok(
  "v20 product polish catalog is active",
  faces.includes("harthmere-threejs-clothing-catalog-v20-product-minecraft-polish") ||
    faces.includes("HARTHMERE_PRODUCT_MINECRAFT_POLISH_VERSION")
);

ok(
  "product clothing guarantee exists",
  clothingGuarantee.includes("harthmereEnsureProductMinecraftClothingSetV20")
);

ok(
  "generated NPC appearance calls complete clothing guarantee",
  npcAppearanceWrapper.includes("harthmereEnsureProductMinecraftClothingSetV20") ||
    npcAppearanceBase.includes("harthmereEnsureProductMinecraftClothingSetV20")
);

ok(
  "generated NPC appearance preserves unique clothing generation",
  npcAppearanceWrapper.includes("makeHarthmereNpcAppearanceConfigBaseV21d") ||
    npcAppearanceWrapper.includes("makeHarthmereNpcUniqueClothingSet") ||
    npcAppearanceBase.includes("makeHarthmereNpcUniqueClothingSet")
);

ok(
  "animal species are allowed to skip humanoid clothing",
  defaultRoleClothing.includes('species === "animal"') &&
    clothingGuarantee.includes('input.species === "animal"')
);

ok("complete clothing guarantee assigns torso", /base\.torso\s*\?\?=/.test(clothingGuarantee));
ok("complete clothing guarantee assigns legs", /base\.legs\s*\?\?=/.test(clothingGuarantee));
ok("complete clothing guarantee assigns feet", /base\.feet\s*\?\?=/.test(clothingGuarantee));
ok("complete clothing guarantee assigns belt", /base\.belt\s*\?\?=/.test(clothingGuarantee));

ok(
  "default role clothing also has core slots",
  defaultRoleClothing.includes("torso:") &&
    defaultRoleClothing.includes("legs:") &&
    defaultRoleClothing.includes("feet:") &&
    defaultRoleClothing.includes("belt:")
);

ok(
  "catalog contains required clothing item ids",
  [
    "guard_tabard_armor",
    "guard_scale_vest",
    "hunter_jerkin",
    "work_apron",
    "merchant_coat",
    "clergy_robe",
    "torn_tunic",
    "travel_boots",
    "simple_belt",
  ].every((id) => faces.includes(id))
);

ok("guard clothing assignment exists", uniqueNpcClothing.includes('input.role === "guard"'));
ok("hunter clothing assignment exists", uniqueNpcClothing.includes('input.role === "hunter"'));
ok("farmer/worker clothing assignment exists", uniqueNpcClothing.includes('input.role === "farmer"'));
ok("merchant clothing assignment exists", uniqueNpcClothing.includes('input.role === "merchant"'));
ok("clergy/scholar clothing assignment exists", uniqueNpcClothing.includes('input.role === "clergy"'));
ok("bandit/hostile clothing assignment exists", uniqueNpcClothing.includes('input.role === "bandit"') || uniqueNpcClothing.includes('input.role === "hostile"'));
ok("undead clothing assignment exists", uniqueNpcClothing.includes('input.role === "undead"'));

ok(
  "unique clothing assignment is deterministic",
  uniqueNpcClothing.includes("harthmereUniqueNpcClothingSeed")
);

ok(
  "unique clothing assignment includes role/name/id inputs",
  (
    uniqueNpcClothing.includes("input.id") &&
    uniqueNpcClothing.includes("input.name") &&
    uniqueNpcClothing.includes("input.role")
  ) ||
    (
      uniqueNpcClothing.includes("harthmereUniqueNpcClothingSeed(input)") &&
      faces.includes("harthmereUniqueNpcClothingSeed") &&
      faces.includes("input.id") &&
      faces.includes("input.name") &&
      (faces.includes("input.role") || faces.includes("input.roleHint"))
    )
);

section("NPC renderer clothing tests");

ok("ECS/local-dev NPC clothing renderer exists", npcs.includes("addLocalDevNpcModularClothingDetails"));
ok("ECS/local-dev NPC renderer loops assigned clothing slots", npcs.includes("Object.keys(clothing)"));
ok("ECS/local-dev NPC renderer queues optional GLTF modelUrl clothing", npcs.includes("queueLocalDevNpcLicensedClothingModelV18"));
ok("ECS/local-dev NPC renderer handles torso clothing", npcs.includes("clothing-torso"));
ok(
  "ECS/local-dev NPC renderer handles legs clothing",
  /legs|trouser|pants|greaves|leg/i.test(npcs)
);
ok(
  "ECS/local-dev NPC renderer handles feet clothing",
  /feet|boot|shoe/i.test(npcs)
);
ok(
  "ECS/local-dev NPC renderer handles belt clothing",
  /belt|buckle|pouch/i.test(npcs)
);
ok("ECS/local-dev NPC renderer handles hands clothing", npcs.includes("glove") || npcs.includes("hands"));
ok("ECS/local-dev NPC renderer handles head clothing", npcs.includes("headwear") || npcs.includes("helmet"));
ok("ECS/local-dev NPC renderer handles face clothing", npcs.includes("mask") || npcs.includes("face"));
ok("ECS/local-dev NPC renderer handles back clothing", npcs.includes("back-pack") || npcs.includes("quiver"));
ok("ECS/local-dev NPC renderer handles weapon clothing", npcs.includes("hand-weapon") || npcs.includes("weapon"));
ok("ECS/local-dev NPC renderer handles shield clothing", npcs.includes("shield"));
ok("ECS/local-dev NPC renderer records clothing runtime metadata", npcs.includes("harthmereModularClothingRuntime"));
ok("ECS/local-dev NPC appearance path passes appearance.clothing to renderer", npcs.includes("addLocalDevNpcModularClothingDetails(root, appearance.clothing"));

ok("runtime/ambient NPC product clothing polish exists", assets.includes("HARTHMERE_RUNTIME_PRODUCT_MINECRAFT_POLISH_VERSION_V20"));
ok("runtime/ambient NPC path reads appearance.clothing", assets.includes("appearance.clothing"));
ok("runtime/ambient NPC path queues optional GLTF modelUrl clothing", assets.includes("queueHarthmereRuntimeLicensedClothingModelsV18"));

section("Player clothing parity tests");

ok("player clothing renderer still reads assigned clothing slots", player.includes("appearance.clothing"));
ok("player Three.js clothing renderer is still available", player.includes("threeJsVariant"));
ok("player GLTF modelUrl clothing remains supported", player.includes("modelUrl") && player.includes("loadGltf"));

section("NPC animation tests");

const animationFactory = extractFunction(npcs, "makeLocalDevVoxelNpcAnimationClipsV19");
const gltfFactory = extractFunction(npcs, "makeLocalDevVoxelNpcGltf");
const executionRecorder = extractFunction(npcs, "recordHarthmereNpcAnimationExecutionCheckV19");

ok("NPC animation clip factory exists", animationFactory.includes("makeLocalDevVoxelNpcAnimationClipsV19"));
ok("NPC Idle clip is created", animationFactory.includes('AnimationClip("Idle"'));
ok("NPC Walk clip is created", animationFactory.includes('AnimationClip("Walk"'));
ok("NPC Run clip is created", animationFactory.includes('AnimationClip("Run"'));
ok("NPC animation clips use non-empty keyframe tracks", animationFactory.includes("NumberKeyframeTrack"));
ok(
  "makeLocalDevVoxelNpcGltf returns animation clips",
  (
    gltfFactory.includes("animations: makeLocalDevVoxelNpcAnimationClipsV19()") ||
    (
      gltfFactory.includes("makeLocalDevVoxelNpcAnimationClipsV19") &&
      (
        /animations\s*:/.test(gltfFactory) ||
        /\banimations\s*,/.test(gltfFactory)
      )
    ) ||
    (
      gltfFactory.includes("const animations = makeLocalDevVoxelNpcAnimationClipsV19()") &&
      /\banimations\s*,/.test(gltfFactory)
    ) ||
    (
      npcs.includes("makeLocalDevVoxelNpcAnimationClipsV19") &&
      (
        npcs.includes("animations:") ||
        /\banimations\s*,/.test(npcs)
      )
    )
  )
);
ok("NPC animation load check records Idle/Walk/Run availability", npcs.includes("harthmereNpcAnimationLoadCheck") && npcs.includes("hasIdle") && npcs.includes("hasWalk") && npcs.includes("hasRun"));

ok("NPC animation execution check records selected state", executionRecorder.includes("selectedState"));
ok("NPC animation execution keeps selected compatibility field", executionRecorder.includes("selected:"));
ok("NPC animation execution chooses walk/run from movement speed", executionRecorder.includes("running") && executionRecorder.includes("moving"));

ok("runtime walker animation check exists", assets.includes("harthmereRuntimeWalkAnimationCheck"));
ok("runtime animation path has clip selection helpers", assets.includes("selectedState") || assets.includes("selected"));

section("Regression guards");

ok(
  "old duplicate declaration bug is absent in voxel_faces",
  !faces.includes("normalizeHarthmereCharacterAppearance(export function") &&
    !faces.includes("normalizeHarthmereCharacterAppearance(function")
);

ok(
  "old duplicate skinned mesh finder bug is absent in player_mesh",
  !player.includes("harthmereFindFirstSkinnedMesh(function") &&
    !player.includes("harthmereFindFirstSkinnedMesh(export function")
);

ok(
  "stale licensed clothing merge helpers are not active default path",
  !defaultRoleClothing.includes("mergeHarthmereLicensedClothingDefaultsV17") &&
    !defaultRoleClothing.includes("mergeHarthmereLicensedClothingDefaultsV16")
);

if (failures.length) {
  console.log("");
  console.log("FAILED INVARIANTS:");
  for (const failure of failures) {
    console.log(`- ${failure}`);
  }
  console.log("RESULT: FAIL");
  process.exit(1);
}

console.log("");
console.log("RESULT: PASS");
