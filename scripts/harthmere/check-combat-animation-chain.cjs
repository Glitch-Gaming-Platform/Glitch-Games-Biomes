#!/usr/bin/env node
const fs = require("fs");
const path = require("path");

const root = process.argv[2] || process.cwd();
const read = (p) => fs.readFileSync(path.join(root, p), "utf8");
const files = {
  combat: read("src/client/components/challenges/LocalDevHarthmereCombat.tsx"),
  multi: read("src/client/components/challenges/LocalDevHarthmereMultiplayerCombatSystem.tsx"),
  hud: read("src/client/components/challenges/HarthmereUnifiedHUD.tsx"),
  renderer: read("src/client/game/renderers/local_dev/harthmere_assets.ts"),
};

const checks = [
  ["B binding is KeyB", /basic:\s*"KeyB"/.test(files.multi)],
  ["N binding is KeyN", /heavy:\s*"KeyN"/.test(files.multi)],
  ["L binding is KeyL", /spark:\s*"KeyL"/.test(files.multi)],
  ["B/N use forward arc", /performHarthmereForwardArcAttack\(attack\)/.test(files.multi)],
  ["Spark remains selected-target", /performHarthmereCombatAttack\(Number\(targetOffset\), attack\)/.test(files.multi)],
  ["No unconditional keyed animation before validation", !/export function performHarthmereKeyedAttack\([^)]*\) \{\s*emitAttackAnimation\(attack\);/.test(files.multi)],
  ["Physical animation emitted after validation", /physical emits only after validation[\s\S]{0,160}emitAttackAnimation\(attack\);[\s\S]{0,160}performHarthmereForwardArcAttack\(attack\)/.test(files.multi)],
  ["HUD bridges keyed attack to native local-player emote", /function useHarthmereLocalPlayerAttackGestureBridge\(\)/.test(files.hud) && /eagerEmote\(events, resources, emoteType\)/.test(files.hud)],
  ["Basic uses attack1 and heavy uses attack2", /attack === "heavy" \? "attack2" : "attack1"/.test(files.hud)],
  ["HUD bridge plays swing sound", /setSound\(resources, audioManager, "attack", "swing"/.test(files.hud)],
  ["HUD calls local-player attack gesture bridge", /useHarthmereLocalPlayerAttackGestureBridge\(\);/.test(files.hud)],
  ["Forward vector uses Biomes viewDir yaw sign", /-Math\.sin\(yaw\), -Math\.cos\(yaw\)/.test(files.combat)],
  ["Forward arc emits explicit physical action fields", /attack:\s*ability[\s\S]{0,80}attackType:\s*ability[\s\S]{0,100}basic_melee_swing/.test(files.combat)],
  ["Renderer recognizes player_swing as physical", /const isPlayerSwingEvent =/.test(files.renderer) && /isPlayerSwingEvent \|\|\s*detail\.effectKind === "physical"/.test(files.renderer)],
  ["Renderer does not call missing this.debugHarthmereRenderer", !/this\.debugHarthmereRenderer\(/.test(files.renderer)],
  ["Renderer has no duplicate attacker declarations from failed patch", (files.renderer.match(/const attackerOffsetMatch =/g) || []).length <= 1],
  ["Renderer defines targetKind before debug use", /const targetKind: CombatPulseKind =/.test(files.renderer) && /targetKind,\s*requestedClips/.test(files.renderer)],
];

let ok = true;
for (const [label, pass] of checks) {
  console.log(`${pass ? "OK" : "FAIL"} ${label}`);
  if (!pass) ok = false;
}
console.log(`\nRESULT: ${ok ? "PASS" : "FAIL"}`);
process.exit(ok ? 0 : 1);
