#!/usr/bin/env node
const fs = require("fs");
const path = require("path");

const repo = path.resolve(process.argv[2] || process.cwd());
const renderer = fs.readFileSync(
  path.join(repo, "src/client/game/renderers/local_dev/harthmere_assets.ts"),
  "utf8"
);
const combatPath = path.join(repo, "src/client/components/challenges/LocalDevHarthmereCombat.tsx");
const combat = fs.existsSync(combatPath) ? fs.readFileSync(combatPath, "utf8") : "";

let failed = false;
function ok(cond, msg) {
  if (!cond) {
    failed = true;
    console.error(`FAIL ${msg}`);
  } else {
    console.log(`OK ${msg}`);
  }
}

ok(renderer.includes("getHarthmerePlayerSwordObjectForManualSwing"), "renderer has sword object lookup for manual swing");
ok(renderer.includes("startHarthmerePlayerSwordManualSwing"), "renderer has manual swing starter");
ok(renderer.includes("applyHarthmerePlayerSwordManualSwing"), "renderer has manual swing applier");
ok(renderer.includes("renderer.player_sword.manual_swing_start"), "renderer logs manual swing start");
ok(renderer.includes("renderer.player_sword.manual_swing_done"), "renderer logs manual swing done");
ok(renderer.includes('harthmereSwordManualClipName === "BasicSlash_24"'), "basic slash starts manual swing");
ok(renderer.includes('harthmereSwordManualClipName === "HeavySlash_24"'), "heavy slash starts manual swing");
ok(renderer.includes("basePosition") && renderer.includes("baseRotation"), "manual swing uses absolute base transform");
ok(renderer.includes("requestAnimationFrame"), "manual swing advances with requestAnimationFrame");
ok(renderer.includes("applyHarthmerePlayerSwordManualSwing();"), "visual update loop applies manual swing when possible");

if (combat) {
  ok(combat.includes("Iron Longsword Slash"), "combat labels basic sword attack as longsword");
  ok(combat.includes("Heavy Iron Longsword Slash"), "combat labels heavy sword attack as longsword");
  ok(!combat.includes("Training Dagger Strike"), "combat no longer labels B attack as training dagger");
}

if (failed) {
  console.error("\nRESULT: FAIL");
  process.exit(1);
}
console.log("\nRESULT: PASS");
