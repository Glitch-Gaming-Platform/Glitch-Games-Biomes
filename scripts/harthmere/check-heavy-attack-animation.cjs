#!/usr/bin/env node
const fs = require("fs");
const path = require("path");

const root = process.argv[2] || process.cwd();
const read = (p) => fs.readFileSync(path.join(root, p), "utf8");
let failed = false;
function check(ok, label) {
  if (ok) {
    console.log(`OK ${label}`);
  } else {
    failed = true;
    console.error(`FAIL ${label}`);
  }
}

const playerAnimations = read("src/client/game/util/player_animations.ts");
const playerMesh = read("src/client/game/resources/player_mesh.ts");
const hudPath = "src/client/components/challenges/HarthmereUnifiedHUD.tsx";
const hud = fs.existsSync(path.join(root, hudPath)) ? read(hudPath) : "";

check(
  /attack1:\s*\{[\s\S]{0,180}fileAnimationName:\s*"HarthmereBodyWeaponBasic_Aligned_30"[\s\S]{0,180}backupFileAnimationNames:\s*\["Attack", "SideSwing"\]/.test(
    playerAnimations
  ),
  "basic attack prefers the authored aligned clip with legacy fallbacks"
);
check(
  /attack2:\s*\{[\s\S]{0,180}fileAnimationName:\s*"HarthmereBodyWeaponHeavy_Aligned_30"[\s\S]{0,220}backupFileAnimationNames:\s*\["HeavyAttack", "Attack2", "Attack"\]/.test(
    playerAnimations
  ),
  "heavy attack prefers the authored aligned clip with HeavyAttack/Attack2 fallbacks"
);
check(
  playerMesh.includes("sourceAnimationNames") &&
    playerMesh.includes("normalizedAnimationNames"),
  "normalizer examines source/normalized clip names"
);
check(
  playerMesh.includes("Do not create Attack2 from Attack") ||
    playerMesh.includes("old unconditional clone"),
  "normalizer documents Attack2 clone bug"
);
check(
  playerMesh.includes('clip.name === "HeavyAttack"'),
  "normalizer uses HeavyAttack as Attack2 alias when needed"
);
check(
  !/else if \(clip\.name === "Attack"\) \{\s*normalized\.push\(clip\);\s*const attack2 = clip\.clone\(\);\s*attack2\.name = "Attack2";/s.test(
    playerMesh
  ),
  "normalizer no longer unconditionally clones Attack into Attack2"
);
if (hud) {
  check(
    hud.includes(
      'const emoteType = attack === "heavy" ? "attack2" : "attack1"'
    ),
    "HUD still maps N/heavy to attack2 emote"
  );
  check(
    hud.includes('"HarthmereBodyWeaponHeavy_Aligned_30"') &&
      hud.includes('"HarthmereBodyWeaponBasic_Aligned_30"'),
    "HUD debug records intended authored file animation"
  );
  check(
    !hud.includes("localPlayer.startAttack(") ||
      hud.includes("Do not call localPlayer.startAttack() here"),
    "HUD bridge avoids random native startAttack emote alternation"
  );
  check(
    hud.includes('source: "deterministic_harthmere_attack_emote"'),
    "HUD debug marks deterministic Harthmere attack source"
  );
}

if (failed) {
  console.error("\nRESULT: FAIL");
  process.exit(1);
}
console.log("\nRESULT: PASS");
