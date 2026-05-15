#!/usr/bin/env node
const fs = require("fs");
const path = require("path");

const repo = path.resolve(process.argv[2] || process.cwd());
const assets = path.join(repo, "src/client/game/renderers/local_dev/harthmere_assets.ts");
const src = fs.readFileSync(assets, "utf8");

let failed = 0;
function ok(cond, msg) {
  if (cond) {
    console.log(`OK ${msg}`);
  } else {
    failed += 1;
    console.error(`FAIL ${msg}`);
  }
}

ok(src.includes("harthmerePlayerSwordManualSwing"), "renderer has manual sword swing state");
ok(src.includes("startHarthmerePlayerSwordManualSwing"), "renderer can start manual sword swing overlay");
ok(src.includes("applyHarthmerePlayerSwordManualSwingOverlay"), "renderer applies manual sword swing overlay");
ok(src.includes("BasicSlash_24") && src.includes('startHarthmerePlayerSwordManualSwing("basic")'), "basic slash starts visible swing overlay");
ok(src.includes("HeavySlash_24") && src.includes('startHarthmerePlayerSwordManualSwing("heavy")'), "heavy slash starts visible swing overlay");
ok(src.includes("installHarthmereLocalDevRendererWarningFilter"), "renderer installs local-dev warning filter");
ok(src.includes("Texture marked for update but no image data found"), "warning filter handles empty texture spam");
ok(src.includes("Found mesh with mix of scene types"), "warning filter handles mixed-scene spam");
ok(src.includes("sanitizeHarthmereSwordTextures"), "renderer sanitizes empty sword texture slots");
ok(src.includes("renderer.player_sword.manual_swing_start"), "renderer logs manual sword swing start");
ok(src.includes("renderer.player_sword.manual_swing_done"), "renderer logs manual sword swing completion");

if (failed) {
  console.error(`\nRESULT: FAIL (${failed})`);
  process.exit(1);
}
console.log("\nRESULT: PASS");
