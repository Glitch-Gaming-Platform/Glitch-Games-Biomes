#!/usr/bin/env node
const fs = require("fs");
const path = require("path");

const root = process.argv[2] || process.cwd();
const files = {
  combat: path.join(root, "src/client/components/challenges/LocalDevHarthmereCombat.tsx"),
  renderer: path.join(root, "src/client/game/renderers/local_dev/harthmere_assets.ts"),
  hud: path.join(root, "src/client/components/challenges/HarthmereUnifiedHUD.tsx"),
};
for (const [name, file] of Object.entries(files)) {
  if (!fs.existsSync(file)) {
    console.error(`FAIL missing ${name}: ${file}`);
    process.exit(1);
  }
}
const combat = fs.readFileSync(files.combat, "utf8");
const renderer = fs.readFileSync(files.renderer, "utf8");
const hud = fs.readFileSync(files.hud, "utf8");
const checks = [
  ["combat revision bumped", /harthmere-full-combat-ai-animation-v1/.test(combat)],
  ["combat reads renderer actor positions", /readHarthmereRuntimeCombatActors/.test(combat)],
  ["combat merges dynamic forward-arc positions", /harthmereForwardArcTargetPositions/.test(combat) && /const targetPositions = harthmereForwardArcTargetPositions\(\)/.test(combat)],
  ["combat infers stats for runtime actors", /statsForRuntimeCombatActor/.test(combat) && /runtimeActorCombatBehavior/.test(combat)],
  ["forward arc still applies damage through resolver", /performHarthmereCombatAttack\(hit\.offset, ability\)/.test(combat)],
  ["death still emits target offset", /ability: "Death Check"[\s\S]*targetOffset/.test(combat)],
  ["renderer auto offsets living actors", /harthmereAutoCombatOffset/.test(renderer) && /combatOffset:\s*combatOffset \?\? harthmereAutoCombatOffset/.test(renderer)],
  ["renderer publishes combat actor snapshot", /publishCombatActorSnapshot/.test(renderer) && /__harthmereCombatActorPositions/.test(renderer)],
  ["renderer stores forward axis", /forwardAxis: harthmereModelForwardAxis\(placement\.asset\)/.test(renderer)],
  ["renderer locks death poses", /deadCombatObjects\.add\(actor\.object\)/.test(renderer)],
  ["renderer expands action clip priorities", /expandHarthmereCombatClipPriority/.test(renderer) && /HeavyAttack/.test(renderer) && /Bite/.test(renderer) && /Death/.test(renderer)],
  ["HUD installs realtime combat AI", /useHarthmereRealtimeCombatAI\(\)/.test(hud)],
  ["HUD keeps forward arc runtime fresh", /useHarthmereForwardArcRuntime\(\)/.test(hud)],
];
let ok = true;
for (const [label, pass] of checks) {
  console.log(`${pass ? "OK" : "FAIL"} ${label}`);
  ok = ok && pass;
}
const badPatterns = [
  ["duplicate forward field", /position,\s*forward,\s*forward,/],
  ["old this.debugHarthmereRenderer crash", /this\.debugHarthmereRenderer/],
  ["duplicate attackerOffsetMatch", /const attackerOffsetMatch[\s\S]*const attackerOffsetMatch/],
  ["undefined targetKind before declaration", /targetKind,\s*requestedClips[\s\S]*const targetKind/],
];
for (const [label, pattern] of badPatterns) {
  const found = pattern.test(combat) || pattern.test(renderer) || pattern.test(hud);
  console.log(`${found ? "FAIL" : "OK"} no ${label}`);
  ok = ok && !found;
}
console.log(`\nRESULT: ${ok ? "PASS" : "FAIL"}`);
process.exit(ok ? 0 : 1);
