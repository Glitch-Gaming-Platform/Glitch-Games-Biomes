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
console.log("== Harthmere attack variation polish tests current ==");
console.log(`Root: ${root}`);
console.log();
check(
  "current variation manifest exists",
  exists("src/shared/harthmere/attack_variation_polish.ts")
);
const manifest = exists("src/shared/harthmere/attack_variation_polish.ts")
  ? read("src/shared/harthmere/attack_variation_polish.ts")
  : "";
const playerAnimations = exists("src/client/game/util/player_animations.ts")
  ? read("src/client/game/util/player_animations.ts")
  : "";
const renderer = exists(
  "src/client/game/renderers/local_dev/harthmere_assets.ts"
)
  ? read("src/client/game/renderers/local_dev/harthmere_assets.ts")
  : "";
const hud = exists("src/client/components/challenges/HarthmereUnifiedHUD.tsx")
  ? read("src/client/components/challenges/HarthmereUnifiedHUD.tsx")
  : "";
const combat = exists(
  "src/client/components/challenges/LocalDevHarthmereMultiplayerCombatSystem.tsx"
)
  ? read(
      "src/client/components/challenges/LocalDevHarthmereMultiplayerCombatSystem.tsx"
    )
  : "";
const suite = exists(
  "scripts/harthmere/test-harthmere-town-placement-suite.cjs"
)
  ? read("scripts/harthmere/test-harthmere-town-placement-suite.cjs")
  : "";

for (const family of [
  "basic",
  "heavy",
  "magic",
  "rangedRelease",
  "shieldBash",
  "toolUse",
]) {
  const count = (manifest.match(new RegExp(`make\\("${family}"`, "g")) || [])
    .length;
  check(`${family} has 4 authored variations`, count === 4, `found ${count}`);
}
check(
  "every variation uses its authored family clock at 24 fps",
  /frameCount:\s*family === "heavy" \? 26 : family === "basic" \? 17 : 24/.test(
    manifest
  ) &&
    /fps:\s*24/.test(manifest) &&
    (manifest.match(/make\(/g) || []).length >= 24
);
check(
  "variations expose major silhouette differences",
  /silhouetteTag/.test(manifest) &&
    /weaponTravelArcDeg/.test(manifest) &&
    /stepForwardMeters/.test(manifest) &&
    /spineBendDeg/.test(manifest)
);
check(
  "basic attack torso yaw span is wide enough to be readable",
  /basic:[\s\S]*torsoYawDeg:\s*-34[\s\S]*torsoYawDeg:\s*34[\s\S]*torsoYawDeg:\s*12[\s\S]*torsoYawDeg:\s*-36/.test(
    manifest
  )
);
check(
  "both melee families preserve four non-repeating combo trajectories",
  (manifest.match(/arc:\s*"horizontal_left_to_right"/g) || []).length >= 2 &&
    (manifest.match(/arc:\s*"horizontal_right_to_left"/g) || []).length >= 2 &&
    (manifest.match(/arc:\s*"vertical_overhead_to_low"/g) || []).length >= 2 &&
    /diagonal_low_left_to_high_right/.test(manifest) &&
    /diagonal_low_right_to_high_left/.test(manifest)
);
check(
  "magic attack includes forward overhead side sweep and ground cast",
  /palm_burst/.test(manifest) &&
    /overhead_invocation/.test(manifest) &&
    /sweeping_sigil/.test(manifest) &&
    /ground_slam_cast/.test(manifest)
);
check(
  "deterministic round-robin cycle exists",
  /advanceHarthmereAttackVariationIndex/.test(manifest) &&
    /% variants.length/.test(manifest)
);
check(
  "player animations import current manifest",
  /attack_variation_polish/.test(playerAnimations)
);
check(
  "player animations expose current selection helper",
  /getHarthmereAttackVariationForAction/.test(playerAnimations)
);
check(
  "player animations map emote types to attack1Var1..4 and attack2Var1..4",
  /attack1Var1/.test(playerAnimations) &&
    /attack1Var4/.test(playerAnimations) &&
    /attack2Var1/.test(playerAnimations) &&
    /attack2Var4/.test(playerAnimations)
);
check(
  "combat and HUD preserve variation emote/id/index metadata",
  /attackVariationEmoteType/.test(hud) &&
    /attackVariationEmoteType/.test(combat) &&
    /attackVariationIndex/.test(hud) &&
    /attackVariationIndex/.test(combat)
);
check(
  "renderer validates main-hand anchoring to left hand",
  /mainHandExpected:\s*"left"/.test(renderer) &&
    /actualHandAnchor/.test(renderer) &&
    /mainHandDistanceMeters/.test(renderer)
);
check(
  "renderer requires left-hand proximity budget",
  /mainHandDistanceBudgetMeters:\s*0\.14/.test(renderer)
);
check(
  "full suite includes current variation polish test",
  /test-harthmere-attack-variation-polish\.cjs/.test(suite)
);
console.log();
console.log(failures ? `RESULT: FAIL (${failures})` : "RESULT: PASS");
process.exit(failures ? 1 : 0);
