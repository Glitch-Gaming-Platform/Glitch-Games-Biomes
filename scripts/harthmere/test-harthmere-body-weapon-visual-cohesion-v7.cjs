#!/usr/bin/env node
/* eslint-disable no-console */
const fs = require("fs");
const path = require("path");

const root = process.argv[2] || process.cwd();
const playerPath = path.join(root, "src/client/game/util/player_animations.ts");
const assetsPath = path.join(root, "src/client/game/renderers/local_dev/harthmere_assets.ts");
const player = fs.readFileSync(playerPath, "utf8");
const assets = fs.readFileSync(assetsPath, "utf8");

let failed = 0;
function check(label, condition, detail) {
  if (condition) {
    console.log(`OK ${label}`);
  } else {
    failed += 1;
    console.error(`FAIL ${label}`);
    if (detail) console.error(`  - ${detail}`);
  }
}

function numberFrom(re, text) {
  const m = text.match(re);
  return m ? Number(m[1]) : NaN;
}

console.log("== Harthmere body/weapon visual cohesion tests v7 ==");
console.log(`Root: ${root}\n`);

check(
  "visual cohesion version marker exists",
  /HARTHMERE_BODY_WEAPON_VISUAL_COHESION_VERSION_V7/.test(player) &&
    /HARTHMERE_BODY_WEAPON_VISUAL_COHESION_VERSION_V7/.test(assets),
);

const upperBodyMask = (player.match(/const HARTHMERE_BODY_UPPER_BODY_RE\s*=\s*\/\(\.\*\(([^)]*)\)\.\*\)\/i;/) || [])[1] || "";
check(
  "weapon body mask excludes torso/root/head bones that caused screenshot twisting",
  upperBodyMask &&
    /arm/.test(upperBodyMask) &&
    /hand/.test(upperBodyMask) &&
    /shoulder/.test(upperBodyMask) &&
    !/(chest|spine|neck|head|body|torso|root)/i.test(upperBodyMask),
  `mask=${upperBodyMask}`,
);

check(
  "weapon-synced body attacks do not apply full-body clip when idle",
  /getHarthmereWeaponSyncedEmoteWeightsV5[\s\S]*layers:\s*\{[\s\S]*arms:\s*"apply"[\s\S]*notArms:\s*"noApply"/.test(player),
  "The screenshot lean happens when notArms is ifIdle/apply for attack1/attack2.",
);

check(
  "weapon body attack has smoother ease-in instead of snap-jitter",
  /HARTHMERE_BODY_WEAPON_ATTACK_EASE_IN_V7\s*=\s*0\.08/.test(player) &&
    /easeInTime:\s*HARTHMERE_BODY_WEAPON_ATTACK_EASE_IN_V7/.test(player),
);

check(
  "ranged/magic/shield/gathering/crafting/building upper-body actions do not steal idle torso",
  /HARTHMERE_FULL_BODY_POSE_LAYER_RULES_V6[\s\S]*rangedAim:\s*\{\s*arms:\s*"apply",\s*notArms:\s*"noApply"/.test(player) &&
    /magicCast:\s*\{\s*arms:\s*"apply",\s*notArms:\s*"noApply"/.test(player) &&
    /shieldBlock:\s*\{\s*arms:\s*"apply",\s*notArms:\s*"noApply"/.test(player) &&
    /gathering:\s*\{\s*arms:\s*"apply",\s*notArms:\s*"noApply"/.test(player) &&
    /crafting:\s*\{\s*arms:\s*"apply",\s*notArms:\s*"noApply"/.test(player) &&
    /building:\s*\{\s*arms:\s*"apply",\s*notArms:\s*"noApply"/.test(player),
);

const rightHand = assets.match(/addAnchor\("harthmere-anchor-right-hand",\s*\[([^\]]+)\]/);
const hip = assets.match(/addAnchor\("harthmere-anchor-hip",\s*\[([^\]]+)\]/);
const rightParts = rightHand ? rightHand[1].split(",").map((s) => Number(s.trim())) : [];
const hipParts = hip ? hip[1].split(",").map((s) => Number(s.trim())) : [];
check(
  "right-hand sword anchor is lowered near the hand instead of shoulder height",
  rightParts.length === 3 && rightParts[1] <= 1.04 && rightParts[2] <= 0.38,
  `rightHand=${rightParts.join(",")}`,
);
check(
  "sheathe/hip anchor is below the hand anchor",
  hipParts.length === 3 && rightParts.length === 3 && hipParts[1] < rightParts[1],
  `hip=${hipParts.join(",")} rightHand=${rightParts.join(",")}`,
);

check(
  "imported sword target size is not oversized for the blocky body",
  /const desiredLongestSide\s*=\s*1\.12;/.test(assets),
);

check(
  "procedural fallback sword was shortened to match body scale",
  /makeHarthmereRuntimeRoundedVoxelGeometry\(\[0\.064,\s*0\.064,\s*1\.02\]\)/.test(assets),
);

check(
  "manual swing remains hand-tracked and does not pull sword away from hand",
  /harthmereWeaponHandTrackingV10/.test(assets) &&
    /maxGripDistanceMeters:\s*0\.22/.test(assets) &&
    /sword\.position\.copy\(currentHandPosition\)/.test(assets) &&
    !/sword\.position\.x \+= 0\.[1-9]/.test(assets) &&
    !/sword\.position\.z \+= \(swing\.attack === "heavy" \? -0\.[1-9]/.test(assets),
  "weapon should follow current hand each frame with <=0.22m grip budget",
);

check(
  "live sword debug records visual-cohesion payload for screenshot probes",
  /harthmereBodyWeaponVisualCohesionV7/.test(assets) && /oversizedManualTranslationPrevented/.test(assets),
);

if (failed) {
  console.error(`\nRESULT: FAIL (${failed})`);
  process.exit(1);
}
console.log("\nRESULT: PASS");
