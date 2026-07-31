#!/usr/bin/env node
"use strict";

const fs = require("fs");
const path = require("path");

const root = process.argv[2] ? path.resolve(process.argv[2]) : process.cwd();
const failures = [];

function check(condition, message) {
  if (condition) {
    console.log(`OK ${message}`);
  } else {
    failures.push(message);
    console.error(`FAIL ${message}`);
  }
}

function readGltf(relativePath) {
  const filePath = path.join(root, relativePath);
  check(fs.existsSync(filePath), `${relativePath} exists`);
  return JSON.parse(fs.readFileSync(filePath, "utf8"));
}

function readGlb(relativePath) {
  const filePath = path.join(root, relativePath);
  check(fs.existsSync(filePath), `${relativePath} exists`);
  if (!fs.existsSync(filePath)) return;
  const data = fs.readFileSync(filePath);
  check(data.toString("utf8", 0, 4) === "glTF", `${relativePath} is a GLB`);
  const jsonLength = data.readUInt32LE(12);
  return JSON.parse(
    data.toString("utf8", 20, 20 + jsonLength).replace(/\0+$/, "")
  );
}

function auditAnimation(
  relativePath,
  animationName,
  expectedChannels,
  exactChannels = false,
  expectedEndSeconds
) {
  const gltf = readGltf(relativePath);
  const animation = (gltf.animations || []).find(
    (candidate) => candidate.name === animationName
  );
  check(Boolean(animation), `${relativePath} contains ${animationName}`);
  if (!animation) return;
  const channelCountMatches = exactChannels
    ? animation.channels.length === expectedChannels
    : animation.channels.length >= (expectedChannels ?? 1);
  check(
    channelCountMatches,
    exactChannels
      ? `${relativePath} ${animationName} preserves exactly ${expectedChannels} keyed channels`
      : `${relativePath} ${animationName} has keyed channels`
  );
  const joints = new Set(
    (gltf.skins || []).flatMap((skin) => skin.joints || [])
  );
  check(joints.size > 0, `${relativePath} contains a skinned skeleton`);
  const invalidTargets = animation.channels.filter(
    (channel) => !joints.has(channel.target.node)
  );
  check(
    invalidTargets.length === 0,
    `${relativePath} ${animationName} targets skeleton joints only`
  );
  if (expectedEndSeconds !== undefined) {
    const timeAccessors = animation.samplers.map(
      (sampler) => gltf.accessors[sampler.input]
    );
    const start = Math.min(...timeAccessors.map((accessor) => accessor.min[0]));
    const end = Math.max(...timeAccessors.map((accessor) => accessor.max[0]));
    check(
      start <= 1 / 24 + 1e-6,
      `${relativePath} ${animationName} starts from its neutral lead-in`
    );
    check(
      Math.abs(end - expectedEndSeconds) < 1e-6,
      `${relativePath} ${animationName} includes its neutral recovery endpoint`
    );
  }
}

const playerPath = "src/galois/data/animations/character-animations.gltf";
for (const [clip, expectedEndSeconds] of [
  ["Crouch", 12 / 24],
  ["CrouchIdle", 24 / 24],
  ["CrouchWalking", 24 / 24],
  ["DodgeLeft", 15 / 24],
  ["DodgeRight", 15 / 24],
  ["DodgeForward", 15 / 24],
  ["DodgeBack", 15 / 24],
  ["EvadeRoll", 16 / 24],
]) {
  auditAnimation(playerPath, clip, 40, false, expectedEndSeconds);
}

// The production attack clips are intentionally not regenerated or renamed by
// the movement-action exporter. Lock their presence/channel count here so a
// future movement pass cannot silently damage the working attack sequence.
auditAnimation(playerPath, "Attack", 48, true);
auditAnimation(playerPath, "Attack2", 48, true);

const assetVersions = JSON.parse(
  fs.readFileSync(
    path.join(root, "src/galois/js/interface/gen/asset_versions.json"),
    "utf8"
  )
);
const publishedPlayerAnimationsPath = path.join(
  "public/buckets/biomes-static",
  assetVersions.paths["wearables/animations"]
);
const publishedPlayerAnimations = readGlb(publishedPlayerAnimationsPath);
if (publishedPlayerAnimations) {
  const publishedClips = new Map(
    (publishedPlayerAnimations.animations || []).map((animation) => [
      animation.name,
      animation,
    ])
  );
  for (const clip of [
    "Crouch",
    "CrouchIdle",
    "CrouchWalking",
    "DodgeLeft",
    "DodgeRight",
    "DodgeForward",
    "DodgeBack",
    "EvadeRoll",
  ]) {
    check(
      publishedClips.get(clip)?.channels?.length === 48,
      `${publishedPlayerAnimationsPath} ships ${clip} with 48 keyed channels`
    );
  }
  for (const [clip, expectedEndSeconds] of [
    ["DodgeLeft", 15 / 24],
    ["DodgeRight", 15 / 24],
    ["DodgeForward", 15 / 24],
    ["DodgeBack", 15 / 24],
    ["EvadeRoll", 16 / 24],
  ]) {
    const animation = publishedClips.get(clip);
    const timeAccessors = animation?.samplers?.map(
      (sampler) => publishedPlayerAnimations.accessors[sampler.input]
    );
    const start = Math.min(
      ...(timeAccessors || []).map((accessor) => accessor.min[0])
    );
    const end = Math.max(
      ...(timeAccessors || []).map((accessor) => accessor.max[0])
    );
    check(
      start <= 1 / 24 + 1e-6 && Math.abs(end - expectedEndSeconds) < 1e-6,
      `${publishedPlayerAnimationsPath} ships ${clip} neutral lead-in and recovery timing`
    );
  }
  for (const clip of ["Attack", "Attack2"]) {
    check(
      publishedClips.get(clip)?.channels?.length === 48,
      `${publishedPlayerAnimationsPath} preserves ${clip} with 48 keyed channels`
    );
  }
}

const playerMeshRuntime = fs.readFileSync(
  path.join(root, "src/client/game/resources/player_mesh.ts"),
  "utf8"
);
for (const animation of [
  "dodgeLeft",
  "dodgeRight",
  "dodgeForward",
  "dodgeBack",
  "evade",
]) {
  check(
    playerMeshRuntime.includes(`${animation}: "${animation}"`),
    `cutscene player mesh maps ${animation} to the gameplay animation system`
  );
}
check(
  playerMeshRuntime.includes("PLAYER_MOVEMENT_ACTION_ANIMATION_NAMES.includes"),
  "cutscene player mesh plays movement actions as finite one-shots"
);

const cutsceneLibraryRuntime = fs.readFileSync(
  path.join(root, "src/client/game/cutscene/harthmere_library.ts"),
  "utf8"
);
check(
  cutsceneLibraryRuntime.includes("HARTHMERE_MOVEMENT_ACTION_SHOWCASE_ID") &&
    cutsceneLibraryRuntime.includes("harthmereMovementActionShowcaseCutscene"),
  "cutscene library registers the movement-action visual showcase"
);

const npcClips = {
  big_mucker: "MuckerEvade",
  cobble_mucker: "MuckerEvade",
  mossy_mucker: "MuckerEvade",
  stone_mucker: "MuckerEvade",
  tree_mucker: "MuckerEvade",
  chrominer: "RobotEvade",
  helping_robot: "RobotEvade",
  robot: "RobotEvade",
  round_robot: "RobotEvade",
  cat: "SideLeap",
  dog: "SideLeap",
  cow: "HeavyEvade",
  sheep: "HeavyEvade",
  rabbit: "QuickHop",
  bird: "WingEvade",
  chicken: "WingEvade",
  duck: "WingEvade",
  fish: "SwimBurst",
  turtle: "SwimBurst",
  hexer: "HexerEvade",
  buddy: "Evade",
  mouse: "Evade",
  dragon: "Evade",
};

for (const [asset, clip] of Object.entries(npcClips)) {
  auditAnimation(`src/galois/data/npcs/${asset}_animations.gltf`, clip);
}

const npcRenderer = fs.readFileSync(
  path.join(root, "src/client/game/resources/npcs.ts"),
  "utf8"
);
for (const clip of [
  "MuckerEvade",
  "RobotEvade",
  "SideLeap",
  "HeavyEvade",
  "QuickHop",
  "WingEvade",
  "SwimBurst",
  "HexerEvade",
]) {
  check(
    npcRenderer.includes(`fileAnimationName: "${clip}"`),
    `NPC renderer selects ${clip}`
  );
}
for (const fallback of ["Dodging", "SidestepLeft", "SidestepRight"]) {
  check(
    npcRenderer.includes(`"${fallback}"`),
    `imported wolf/deer/bear assets retain ${fallback} fallback support`
  );
}

if (failures.length > 0) {
  console.error(`RESULT FAIL (${failures.length} checks)`);
  process.exit(1);
}
console.log("RESULT PASS");
