#!/usr/bin/env node
const fs = require("fs");
const path = require("path");
const root = process.argv[2] || process.cwd();
const read = (p) => fs.readFileSync(path.join(root, p), "utf8");
let failed = false;
function check(ok, label) {
  if (ok) console.log(`OK ${label}`);
  else { failed = true; console.error(`FAIL ${label}`); }
}
const combat = read("src/client/components/challenges/LocalDevHarthmereCombat.tsx");
const hud = read("src/client/components/challenges/HarthmereUnifiedHUD.tsx");
const renderer = read("src/client/game/renderers/local_dev/harthmere_assets.ts");
check(combat.includes("harthmere-sword-facing-direction-fix"), "combat ranker patched");
check(combat.includes("[-Math.sin(yaw), -Math.cos(yaw)]"), "visible body forward uses inverse yaw basis");
check(combat.includes("forward_arc.direction_autofix"), "combat logs direction autofix");
check(combat.includes("base forward missed but inverse forward found targets"), "combat probes inverse forward when base misses");
check(combat.includes("rawForward: baseForward"), "nearest debug includes raw forward");
check(combat.includes("invertedForwardUsed"), "nearest debug includes inverted flag");
check(hud.includes('const itemId = "iron_longsword";'), "HUD visual bridge stays on longsword id");
check(hud.includes("training_dagger, which do not have this visual attached yet"), "HUD explains dagger override prevention");
check(renderer.includes("bodyForward is already normalized to visible Harthmere model facing"), "renderer documents visible forward source");
if (failed) { console.error("\nRESULT: FAIL"); process.exit(1); }
console.log("\nRESULT: PASS");
