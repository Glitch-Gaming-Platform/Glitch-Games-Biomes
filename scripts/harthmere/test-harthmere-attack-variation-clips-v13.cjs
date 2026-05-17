#!/usr/bin/env node
const fs = require("fs");
const path = require("path");
const root = process.argv[2] || process.cwd();
const read = (p) => fs.readFileSync(path.join(root, p), "utf8");
const exists = (p) => fs.existsSync(path.join(root, p));
let failures = 0;
function check(label, cond, extra) {
  if (cond) {
    console.log(`OK ${label}`);
  } else {
    failures += 1;
    console.log(`FAIL ${label}`);
    if (extra) console.log(`  - ${extra}`);
  }
}
console.log("== Harthmere attack variation clip tests v13 ==");
console.log(`Root: ${root}`);
console.log();
check("attack variation manifest exists", exists("src/shared/harthmere/attack_variation_manifest_v13.ts"));
const manifest = read("src/shared/harthmere/attack_variation_manifest_v13.ts");
const playerAnimations = read("src/client/game/util/player_animations.ts");
const hud = read("src/client/components/challenges/HarthmereUnifiedHUD.tsx");
const combat = read("src/client/components/challenges/LocalDevHarthmereMultiplayerCombatSystem.tsx");
const renderer = read("src/client/game/renderers/local_dev/harthmere_assets.ts");
for (const family of ["basic", "heavy", "magic", "rangedRelease", "shieldBash", "toolUse"]) {
  const count = (manifest.match(new RegExp(`v\\(\\"${family}\\"`, "g")) || []).length;
  check(`${family} has 4 variations`, count === 4, `found ${count}`);
}
check("all variations are 24 keyframes / 24 fps", /frameCount:\s*24/.test(manifest) && /fps:\s*24/.test(manifest));
check("variation manifest defines windup/impact/recovery metadata", /windupFrame/.test(manifest) && /impactFrame/.test(manifest) && /recoveryFrame/.test(manifest));
check("variation picker avoids immediate repetition", /variant\.id !== last && variant\.id !== prior/.test(manifest));
check("player animation system imports attack variation manifest", /attack_variation_manifest_v13/.test(playerAnimations));
check("player animation system exposes v13 variation selector marker", /HARTHMERE_ATTACK_VARIATION_VERSION_V13/.test(playerAnimations));
check("player animation system picks aligned basic attack variation", /pickHarthmereAttackVariationV13\(\s*"basic"/.test(playerAnimations));
check("player animation system picks aligned heavy attack variation", /pickHarthmereAttackVariationV13\(\s*"heavy"/.test(playerAnimations));
check("player animation system picks magic variation", /pickHarthmereAttackVariationV13\(\s*"magic"/.test(playerAnimations));
check("HUD bridge preserves variation metadata for live tests", /attackVariationId/.test(hud) && /attackVariationFamily/.test(hud));
check("combat system emits variation metadata", /attackVariationId/.test(combat) && /attackVariationFamily/.test(combat));
check("renderer exposes attack variation debug bridge", /attackVariationAudit/.test(renderer));
check("renderer supports weapon yaw/pitch bias from variation metadata", /weaponYawBiasDeg/.test(renderer) && /weaponPitchBiasDeg/.test(renderer));
check("renderer supports handedness/side-aware variation playback", /attackSide/.test(renderer));
check("edge-case contract covers locomotion and air legality", /locomotionAllowed/.test(manifest) && /airAllowed/.test(manifest));

check("basic attack variations use four distinct body animation clip names", [1,2,3,4].every((i) => manifest.includes(`HarthmereBodyWeaponBasic_Variation${i}_24`)));
check("heavy attack variations use four distinct body animation clip names", [1,2,3,4].every((i) => manifest.includes(`HarthmereBodyWeaponHeavy_Variation${i}_24`)));
check("magic/ranged/shield/tool variations use concrete variation clip names", [
  "HarthmereBodyMagicCast_Variation4_24",
  "HarthmereBodyRangedRelease_Variation4_24",
  "HarthmereBodyShieldBash_Variation4_24",
  "HarthmereBodyToolUse_Variation4_24",
].every((name) => manifest.includes(name)));
check("player animation system defines concrete basic/heavy variation animation keys", [1,2,3,4].every((i) => playerAnimations.includes(`attack1Var${i}`) && playerAnimations.includes(`attack2Var${i}`)));
check("player animation runtime selects a variation per attack start time", /getHarthmereAttackVariationEmoteTypeV15/.test(playerAnimations) && /harthmereCachedAttackVariationStartTimeV15 === emoteStartTime/.test(playerAnimations));
check("player animation runtime plays the selected variation animation key", /singleAnimationWeight\(harthmereVariationEmoteTypeV15, 1\)/.test(playerAnimations));

check("full suite includes attack variation v13 test", exists("scripts/harthmere/test-harthmere-town-placement-suite-v1.cjs") && /test-harthmere-attack-variation-clips-v13\.cjs/.test(read("scripts/harthmere/test-harthmere-town-placement-suite-v1.cjs")));
console.log();
console.log(failures ? `RESULT: FAIL (${failures})` : "RESULT: PASS");
process.exit(failures ? 1 : 0);
