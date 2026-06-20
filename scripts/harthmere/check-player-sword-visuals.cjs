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
const inv = read("src/client/components/challenges/LocalDevHarthmereInventorySystem.tsx");
const hud = read("src/client/components/challenges/HarthmereUnifiedHUD.tsx");
const multi = read("src/client/components/challenges/LocalDevHarthmereMultiplayerCombatSystem.tsx");
const renderer = read("src/client/game/renderers/local_dev/harthmere_assets.ts");
check(inv.includes("ensureHarthmereStarterSwordGranted"), "inventory grants starter sword");
check(inv.includes('makeItemInstance("iron_longsword"'), "inventory creates iron longsword");
check(hud.includes("useHarthmerePlayerSwordVisualBridge"), "HUD installs sword visual bridge");
check(hud.includes("biomes:harthmere-player-sword-visual"), "HUD emits sword visual event");
check(multi.includes("emitHarthmereWeaponVisualState"), "multiplayer emits weapon visual state");
check(multi.includes("Weapon Not Drawn"), "first attack draws instead of invisible attacking");
check(multi.includes("emitHarthmereWeaponVisualState(\"attack\", true, attack)"), "attacks pulse sword visual");
check(renderer.includes("HarthmerePlayerSwordVisualState"), "renderer has sword visual state type");
check(renderer.includes("ensureHarthmerePlayerSword"), "renderer creates procedural sword");
check(renderer.includes("updateHarthmerePlayerSwordVisual"), "renderer updates sword placement");
check(renderer.includes("installHarthmerePlayerSwordVisuals"), "renderer listens for sword visual event");
check(renderer.includes("harthmere-local-player-iron-longsword"), "renderer names local player sword object");
check(renderer.includes("this.root.add(sword)"), "renderer attaches sword to Harthmere root");
if (failed) { console.error("\nRESULT: FAIL"); process.exit(1); }
console.log("\nRESULT: PASS");
