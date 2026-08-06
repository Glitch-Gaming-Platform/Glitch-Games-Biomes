#!/usr/bin/env node
/* eslint-disable no-console */
const fs = require("fs");
const path = require("path");

const root = process.argv[2] || process.cwd();
const playerPath = path.join(root, "src/client/game/util/player_animations.ts");
const assetsPath = path.join(
  root,
  "src/client/game/renderers/local_dev/harthmere_assets.ts"
);
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

console.log("== Harthmere body/weapon visual cohesion tests current ==");
console.log(`Root: ${root}\n`);

check(
  "visual cohesion version marker exists",
  /HARTHMERE_BODY_WEAPON_VISUAL_COHESION_VERSION/.test(player) &&
    /HARTHMERE_BODY_WEAPON_VISUAL_COHESION_VERSION/.test(assets)
);

const upperBodyMask =
  (player.match(
    /const HARTHMERE_BODY_UPPER_BODY_RE\s*=\s*\/\(\.\*\(([^)]*)\)\.\*\)\/i;/
  ) || [])[1] || "";
check(
  "weapon body mask includes the authored upper-body chain but excludes locomotion bones",
  upperBodyMask &&
    /arm/.test(upperBodyMask) &&
    /hand/.test(upperBodyMask) &&
    /shoulder/.test(upperBodyMask) &&
    /chest/.test(upperBodyMask) &&
    /spine/.test(upperBodyMask) &&
    !/(root|hip|pelvis|leg|foot)/i.test(upperBodyMask),
  `mask=${upperBodyMask}`
);

check(
  "weapon-synced body attacks use authored footwork only while idle",
  /getHarthmereWeaponSyncedEmoteWeights[\s\S]*hasHarthmereWeaponClip[\s\S]*harthmereWeaponBody[\s\S]*layers:\s*\{[\s\S]*arms:\s*"apply"[\s\S]*notArms:\s*"ifIdle"/.test(
    player
  ),
  "Moving locomotion must own the lower body while the planted idle attack may use authored footwork."
);

check(
  "weapon body attack has smoother ease-in instead of snap-jitter",
  /HARTHMERE_BODY_WEAPON_ATTACK_EASE_IN\s*=\s*0\.08/.test(player) &&
    /easeInTime:\s*HARTHMERE_BODY_WEAPON_ATTACK_EASE_IN/.test(player)
);

check(
  "ranged/magic/shield/gathering/crafting/building upper-body actions do not steal idle torso",
  /HARTHMERE_FULL_BODY_POSE_LAYER_RULES[\s\S]*rangedAim:\s*\{\s*arms:\s*"apply",\s*notArms:\s*"noApply"/.test(
    player
  ) &&
    /magicCast:\s*\{\s*arms:\s*"apply",\s*notArms:\s*"noApply"/.test(player) &&
    /shieldBlock:\s*\{\s*arms:\s*"apply",\s*notArms:\s*"noApply"/.test(
      player
    ) &&
    /gathering:\s*\{\s*arms:\s*"apply",\s*notArms:\s*"noApply"/.test(player) &&
    /crafting:\s*\{\s*arms:\s*"apply",\s*notArms:\s*"noApply"/.test(player) &&
    /building:\s*\{\s*arms:\s*"apply",\s*notArms:\s*"noApply"/.test(player)
);

const mainHand = assets.match(
  /addAnchor\(\s*"harthmere-anchor-left-hand",\s*\[([^\]]+)\]/
);
const hip = assets.match(
  /addAnchor\(\s*"harthmere-anchor-hip",\s*\[([^\]]+)\]/
);
const mainHandParts = mainHand
  ? mainHand[1].split(",").map((s) => Number(s.trim()))
  : [];
const hipParts = hip ? hip[1].split(",").map((s) => Number(s.trim())) : [];
check(
  "left main-hand sword anchor is lowered near the hand instead of shoulder height",
  mainHandParts.length === 3 &&
    mainHandParts[1] <= 1.04 &&
    mainHandParts[2] <= 0.38,
  `mainHand=${mainHandParts.join(",")}`
);
check(
  "sheathe/hip anchor is below the hand anchor",
  hipParts.length === 3 &&
    mainHandParts.length === 3 &&
    hipParts[1] < mainHandParts[1],
  `hip=${hipParts.join(",")} mainHand=${mainHandParts.join(",")}`
);

check(
  "imported sword target size is not oversized for the blocky body",
  /desiredLongestSide\s*=\s*1\.12/.test(assets)
);

check(
  "procedural fallback sword was shortened to match body scale",
  /makeHarthmereRuntimeRoundedVoxelGeometry\(\[0\.064,\s*0\.064,\s*1\.02\]\)/.test(
    assets
  )
);

check(
  "manual swing remains hand-tracked and does not pull sword away from hand",
  /harthmereWeaponHandTracking/.test(assets) &&
    /maxGripDistanceMeters:\s*0\.22/.test(assets) &&
    /sword\.position\.copy\(currentHandPosition\)/.test(assets) &&
    !/sword\.position\.x \+= 0\.[1-9]/.test(assets) &&
    !/sword\.position\.z \+= \(swing\.attack === "heavy" \? -0\.[1-9]/.test(
      assets
    ),
  "weapon should follow current hand each frame with <=0.22m grip budget"
);

check(
  "live sword debug records visual-cohesion payload for screenshot probes",
  /harthmereBodyWeaponVisualCohesion/.test(assets) &&
    /oversizedManualTranslationPrevented/.test(assets)
);

if (failed) {
  console.error(`\nRESULT: FAIL (${failed})`);
  process.exit(1);
}
console.log("\nRESULT: PASS");
