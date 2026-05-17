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
console.log("== Harthmere attack variation polish tests v17 ==");
console.log(`Root: ${root}`);
console.log();
check("v17 variation manifest exists", exists("src/shared/harthmere/attack_variation_polish_v17.ts"));
const manifest = exists("src/shared/harthmere/attack_variation_polish_v17.ts") ? read("src/shared/harthmere/attack_variation_polish_v17.ts") : "";
const playerAnimations = exists("src/client/game/util/player_animations.ts") ? read("src/client/game/util/player_animations.ts") : "";
const renderer = exists("src/client/game/renderers/local_dev/harthmere_assets.ts") ? read("src/client/game/renderers/local_dev/harthmere_assets.ts") : "";
const hud = exists("src/client/components/challenges/HarthmereUnifiedHUD.tsx") ? read("src/client/components/challenges/HarthmereUnifiedHUD.tsx") : "";
const combat = exists("src/client/components/challenges/LocalDevHarthmereMultiplayerCombatSystem.tsx") ? read("src/client/components/challenges/LocalDevHarthmereMultiplayerCombatSystem.tsx") : "";
const suite = exists("scripts/harthmere/test-harthmere-town-placement-suite-v1.cjs") ? read("scripts/harthmere/test-harthmere-town-placement-suite-v1.cjs") : "";

for (const family of ["basic","heavy","magic","rangedRelease","shieldBash","toolUse"]) {
  const count = (manifest.match(new RegExp(`make\\("${family}"`, 'g')) || []).length;
  check(`${family} has 4 authored variations`, count === 4, `found ${count}`);
}
check("every variation is authored at 24 frames / 24 fps", (manifest.match(/frameCount:\s*24/g) || []).length >= 24 && (manifest.match(/fps:\s*24/g) || []).length >= 24);
check("variations expose major silhouette differences", /silhouetteTag/.test(manifest) && /weaponTravelArcDeg/.test(manifest) && /stepForwardMeters/.test(manifest) && /spineBendDeg/.test(manifest));
check("basic attack torso yaw span is wide enough to be readable", /basic:[\s\S]*torsoYawDeg: 18[\s\S]*torsoYawDeg: -24[\s\S]*torsoYawDeg: 28/.test(manifest));
check("heavy attack includes overhead sweep backhand and lunge", /overhead_cleave/.test(manifest) && /broad_side_sweep/.test(manifest) && /backhand_crusher/.test(manifest) && /heavy_lunge/.test(manifest));
check("magic attack includes forward overhead side sweep and ground cast", /palm_burst/.test(manifest) && /overhead_invocation/.test(manifest) && /sweeping_sigil/.test(manifest) && /ground_slam_cast/.test(manifest));
check("deterministic round-robin cycle exists", /advanceHarthmereAttackVariationIndexV17/.test(manifest) && /% variants.length/.test(manifest));
check("player animations import v17 manifest", /attack_variation_polish_v17/.test(playerAnimations));
check("player animations expose v17 selection helper", /getHarthmereAttackVariationForActionV17/.test(playerAnimations));
check("player animations map emote types to attack1Var1..4 and attack2Var1..4", /attack1Var1/.test(playerAnimations) && /attack1Var4/.test(playerAnimations) && /attack2Var1/.test(playerAnimations) && /attack2Var4/.test(playerAnimations));
check("combat and HUD preserve variation emote/id/index metadata", /attackVariationEmoteType/.test(hud) && /attackVariationEmoteType/.test(combat) && /attackVariationIndex/.test(hud) && /attackVariationIndex/.test(combat));
check("renderer validates main-hand anchoring to right hand", /mainHandExpected:\s*"right"/.test(renderer) && /actualHandAnchor/.test(renderer) && /mainHandDistanceMeters/.test(renderer));
check("renderer requires right-hand proximity budget", /mainHandDistanceBudgetMeters:\s*0\.14/.test(renderer));
check("full suite includes v17 variation polish test", /test-harthmere-attack-variation-polish-v17\.cjs/.test(suite));
console.log();
console.log(failures ? `RESULT: FAIL (${failures})` : "RESULT: PASS");
process.exit(failures ? 1 : 0);
