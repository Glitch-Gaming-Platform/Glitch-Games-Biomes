#!/usr/bin/env node
const fs = require("fs");
const path = require("path");

const root = process.argv[2] || process.cwd();
const combatPath = path.join(root, "src/client/components/challenges/LocalDevHarthmereCombat.tsx");
const rendererPath = path.join(root, "src/client/game/renderers/local_dev/harthmere_assets.ts");
const combat = fs.readFileSync(combatPath, "utf8");
const renderer = fs.readFileSync(rendererPath, "utf8");

const checks = [
  ["revision bumped", /harthmere-combat-ai-edgecases-v2/.test(combat)],
  ["forward arc logs nearest candidates", /forward_arc\.nearest/.test(combat) && /nearest: arc\.nearest/.test(combat)],
  ["forward arc uses live target positions", /harthmereForwardArcTargetPositions/.test(combat) && /readHarthmereRuntimeCombatActors/.test(combat)],
  ["forward arc has close-contact forgiveness", /closeBodyContact/.test(combat)],
  ["applyAttack logs HP deltas", /combat\.attack\.resolved/.test(combat) && /targetHpBefore/.test(combat) && /targetHpAfter/.test(combat)],
  ["counterattacks require real damage", /playerAttack\.finalDamage > 0/.test(combat)],
  ["counterattacks are range gated", /harthmereNpcCanReachPlayerNow\(targetOffset, target\)/.test(combat)],
  ["realtime AI is range gated", /combat\.ai\.range_skip/.test(combat) && /out_of_melee_range/.test(combat)],
  ["defensive merchants are counter only", /counter_only_behavior/.test(combat) && /harthmereShouldNpcContinueRealtimeCombat/.test(combat)],
  ["renderer ignores stale pulses on dead actors", /ignored_dead_actor/.test(renderer)],
];

let ok = true;
for (const [label, pass] of checks) {
  console.log(`${pass ? "OK" : "FAIL"} ${label}`);
  ok = ok && pass;
}

const badPatterns = [
  ["old this.debugHarthmereRenderer crash", /this\.debugHarthmereRenderer/],
  ["duplicate attackerOffsetMatch", /const attackerOffsetMatch[\s\S]*const attackerOffsetMatch/],
  ["undefined targetKind before declaration", /targetKind,\s*requestedClips[\s\S]*const targetKind/],
];
for (const [label, pattern] of badPatterns) {
  const found = pattern.test(combat) || pattern.test(renderer);
  console.log(`${found ? "FAIL" : "OK"} no ${label}`);
  ok = ok && !found;
}

console.log(`\nRESULT: ${ok ? "PASS" : "FAIL"}`);
process.exit(ok ? 0 : 1);
