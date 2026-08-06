#!/usr/bin/env node
"use strict";

const fs = require("fs");
const path = require("path");

const root = process.argv[2] ? path.resolve(process.argv[2]) : process.cwd();
const failures = [];

function check(condition, message) {
  console.log(`${condition ? "OK" : "FAIL"} ${message}`);
  if (!condition) failures.push(message);
}

function readGlb(filePath) {
  const bytes = fs.readFileSync(filePath);
  check(bytes.toString("utf8", 0, 4) === "glTF", `${filePath} is a GLB`);
  const jsonLength = bytes.readUInt32LE(12);
  return JSON.parse(
    bytes.toString("utf8", 20, 20 + jsonLength).replace(/\0+$/, "")
  );
}

const versions = JSON.parse(
  fs.readFileSync(
    path.join(root, "src/galois/js/interface/gen/asset_versions.json"),
    "utf8"
  )
);
const relativePublished = path.join(
  "public/buckets/biomes-static",
  versions.paths["wearables/animations"]
);
const publishedPath = path.join(root, relativePublished);
check(fs.existsSync(publishedPath), `${relativePublished} exists`);
const glb = readGlb(publishedPath);
const clips = new Map(
  (glb.animations || []).map((animation) => [animation.name, animation])
);

const directions = [
  [1, "forehand", "wide_forehand", "horizontal_right_to_left"],
  [2, "backhand", "backhand_return", "horizontal_left_to_right"],
  [3, "descending", "descending_cleave", "high_right_to_low_left"],
  [4, "rising", "rising_cut", "low_left_to_high_right"],
];

for (const [family, impactSeconds, durationSeconds] of [
  ["Basic", 6 / 24, 17 / 24],
  ["Heavy", 10 / 24, 26 / 24],
]) {
  const expected =
    family === "Basic"
      ? directions
      : [
          [1, "overhead", "overhead_cleave", "vertical_high_to_low"],
          [2, "sweep", "broad_side_sweep", "horizontal_left_to_right"],
          [3, "crusher", "backhand_crusher", "high_left_to_low_right"],
          [4, "uppercut", "rising_finisher", "low_right_to_high_left"],
        ];
  for (const [index, style, direction, weaponArc] of expected) {
    const name = `HarthmereBodyWeapon${family}_Variation${index}_24`;
    const clip = clips.get(name);
    check(Boolean(clip), `${relativePublished} ships ${name}`);
    if (!clip) continue;
    check(clip.channels?.length === 48, `${name} keys all 16 player bones`);
    check(
      clip.extras?.harthmereCombatProfile === "aaa-voxel-sword-v2",
      `${name} identifies the authored AAA voxel profile`
    );
    check(
      clip.extras?.direction === direction &&
        clip.extras?.attackStyle === style,
      `${name} direction is ${direction}`
    );
    check(clip.extras?.weaponArc === weaponArc, `${name} arc is ${weaponArc}`);
    check(
      Math.abs(clip.extras?.impactSeconds - impactSeconds) < 1e-6,
      `${name} impact is ${impactSeconds.toFixed(3)} seconds`
    );
    check(
      Math.abs(clip.extras?.durationSeconds - durationSeconds) < 1e-6,
      `${name} recovery clock is ${durationSeconds.toFixed(3)} seconds`
    );
    check(
      JSON.stringify((clip.extras?.phases || []).map((phase) => phase.name)) ===
        JSON.stringify([
          "anticipation",
          "strike",
          "impact",
          "followThrough",
          "recovery",
        ]),
      `${name} exports all five combat phases`
    );
  }
}

for (const [name, source] of [
  [
    "HarthmereBodyWeaponBasic_Aligned_30",
    "HarthmereBodyWeaponBasic_Variation1_24",
  ],
  [
    "HarthmereBodyWeaponHeavy_Aligned_30",
    "HarthmereBodyWeaponHeavy_Variation1_24",
  ],
]) {
  const clip = clips.get(name);
  check(Boolean(clip), `${relativePublished} ships ${name}`);
  check(
    clip?.extras?.alignedFallbackOf === source,
    `${name} is an explicit authored fallback`
  );
}

const runtime = fs.readFileSync(
  path.join(root, "src/client/game/util/player_animations.ts"),
  "utf8"
);
check(
  runtime.includes('resolveAssetUrl("wearables/animations")') ||
    fs
      .readFileSync(
        path.join(root, "src/client/game/resources/player_mesh.ts"),
        "utf8"
      )
      .includes('resolveAssetUrl("wearables/animations")'),
  "the player client resolves the same canonical wearables/animations artifact"
);
check(
  /notArms:\s*"ifIdle"/.test(runtime),
  "authored attack footwork plays while idle and locomotion owns moving legs"
);

console.log(
  failures.length
    ? `RESULT: FAIL (${failures.length})`
    : `RESULT: PASS published=${relativePublished} clips=${clips.size}`
);
process.exit(failures.length ? 1 : 0);
