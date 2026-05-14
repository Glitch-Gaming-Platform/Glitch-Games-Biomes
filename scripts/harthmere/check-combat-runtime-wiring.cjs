#!/usr/bin/env node
const fs = require("fs");
const path = require("path");
const root = process.argv[2] ? path.resolve(process.argv[2]) : process.cwd();
const files = {
  combat: "src/client/components/challenges/LocalDevHarthmereCombat.tsx",
  mp: "src/client/components/challenges/LocalDevHarthmereMultiplayerCombatSystem.tsx",
  assets: "src/client/game/renderers/local_dev/harthmere_assets.ts",
};
const checks = {
  combat: [
    "harthmere-combat-debug-probe-v8",
    "debugHarthmereCombat",
    "combat.attack.start",
    "combat.attack.after_player",
    "combat.countercheck",
    "combat.counterattack",
    "__harthmereCombatDebug",
    "performHarthmereCombatAttack(9003",
  ],
  mp: [
    "debugHarthmereKeyCombat",
    "keyed.hotkey",
    "keyed.attack.start",
    "performHarthmereCombatAttack(targetOffset, attack)",
  ],
  assets: [
    "debugHarthmereRenderer",
    "renderer.combat_event.received",
    "renderer.combat_event.attacker_match",
    "renderer.combat_event.target_match",
    "renderer.start_pulse",
    "__harthmereRendererDebug",
    "forcePulse",
    "fakeBanditHit",
  ],
};
let ok = true;
for (const [key, rel] of Object.entries(files)) {
  const full = path.join(root, rel);
  if (!fs.existsSync(full)) {
    console.log(`MISSING FILE ${rel}`);
    ok = false;
    continue;
  }
  const text = fs.readFileSync(full, "utf8");
  console.log(`\n${rel}`);
  for (const needle of checks[key]) {
    const found = text.includes(needle);
    console.log(`  ${found ? "OK" : "MISSING"} ${needle}`);
    if (!found) ok = false;
  }
}
console.log(`\nRESULT: ${ok ? "PASS" : "FAIL"}`);
process.exit(ok ? 0 : 1);
