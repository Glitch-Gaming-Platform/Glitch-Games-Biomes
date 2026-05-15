#!/usr/bin/env node
const fs = require("fs");
const path = require("path");

const repo = path.resolve(process.argv[2] || process.cwd());
const rendererPath = path.join(repo, "src/client/game/renderers/local_dev/harthmere_assets.ts");
const challengeDir = path.join(repo, "src/client/components/challenges");
const renderer = fs.readFileSync(rendererPath, "utf8");
let challengeText = "";
if (fs.existsSync(challengeDir)) {
  for (const file of fs.readdirSync(challengeDir)) {
    if (file.includes("Harthmere") && file.endsWith(".tsx")) {
      challengeText += "\n// " + file + "\n" + fs.readFileSync(path.join(challengeDir, file), "utf8");
    }
  }
}

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
ok(renderer.includes("HarthmereLocalPlayerSword") || renderer.includes("HarthmerePlayerSword"), "manual swing lookup can find named sword object");
ok(renderer.includes("startHarthmerePlayerSwordManualSwing"), "renderer has manual swing starter");
ok(renderer.includes("applyHarthmerePlayerSwordManualSwing"), "renderer has manual swing applier");
ok(renderer.includes("renderer.player_sword.manual_swing_start"), "renderer logs manual swing start");
ok(renderer.includes("renderer.player_sword.manual_swing_done"), "renderer logs manual swing done");
ok(renderer.includes('harthmereSwordManualClipName === "BasicSlash_24"'), "basic slash clip starts manual swing");
ok(renderer.includes('harthmereSwordManualClipName === "HeavySlash_24"'), "heavy slash clip starts manual swing");
ok(renderer.includes("harthmereSwordVisualAttackForManualSwing"), "state attack event also starts manual swing");
ok(renderer.includes("basePosition: sword.position.clone()"), "manual swing captures absolute base position");
ok(renderer.includes("baseRotation: sword.rotation.clone()"), "manual swing captures absolute base rotation");
ok(renderer.includes("sword.position.copy(state.basePosition)"), "manual swing reapplies absolute base position");
ok(renderer.includes("sword.rotation.copy(state.baseRotation)"), "manual swing reapplies absolute base rotation");
ok(renderer.includes("requestAnimationFrame"), "manual swing advances with requestAnimationFrame");
ok(renderer.includes("this.applyHarthmerePlayerSwordManualSwing();"), "visual update loop applies manual swing when possible");

ok(challengeText.includes("Iron Longsword Slash"), "combat labels basic sword attack as longsword");
ok(challengeText.includes("Heavy Iron Longsword Slash"), "combat labels heavy sword attack as longsword");
ok(!challengeText.includes("Training Dagger Strike"), "combat no longer labels B attack as training dagger strike");
ok(!challengeText.includes("Heavy Training Dagger Strike"), "combat no longer labels N attack as heavy training dagger strike");

if (failed) {
  console.error("\nRESULT: FAIL");
  process.exit(1);
}
console.log("\nRESULT: PASS");
