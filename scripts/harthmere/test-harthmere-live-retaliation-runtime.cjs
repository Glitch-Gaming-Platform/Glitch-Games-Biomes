#!/usr/bin/env node
const fs = require('fs');
const path = require('path');

const root = process.argv[2] ? path.resolve(process.argv[2]) : process.cwd();
const combatPath = path.join(root, 'src/client/components/challenges/LocalDevHarthmereCombat.tsx');
const rendererPath = path.join(root, 'src/client/game/renderers/local_dev/harthmere_assets.ts');

function read(file) {
  return fs.readFileSync(file, 'utf8');
}

const combat = read(combatPath);
const renderer = fs.existsSync(rendererPath) ? read(rendererPath) : '';
let failures = 0;
function ok(condition, message, detail = '') {
  if (condition) {
    console.log(`OK ${message}`);
  } else {
    failures++;
    console.error(`FAIL ${message}${detail ? `\n  ${detail}` : ''}`);
  }
}

console.log('== Harthmere live NPC retaliation runtime current ==');

ok(combat.includes('HARTHMERE_NPC_RETALIATION_RUNTIME'), 'runtime retaliation fix is versioned');
ok(/type\s+HarthmereRetaliationAttackOptions[\s\S]*contactProven\?:\s*boolean/.test(combat), 'attack options carry renderer-proven contact');
ok(/performHarthmereCombatAttack\(\s*hit\.offset,\s*ability,\s*\{[\s\S]{0,220}contactProven:\s*true[\s\S]{0,220}contactSource:\s*"forward_arc"/.test(combat), 'forward-arc melee passes contactProven into combat resolver');
ok(/implicitMeleeContact[\s\S]{0,160}ability\s*!==\s*"spark"[\s\S]{0,180}playerAttack\.finalDamage\s*>\s*0/.test(combat), 'direct melee damage also implies contact for retaliation');
ok(/const\s+retaliationReachOk\s*=\s*reachCheck\.canReach\s*\|\|\s*contactProven/.test(combat), 'stale range lookup cannot cancel a visible sword-hit retaliation');
ok(/const\s+canCounterattack\s*=[\s\S]{0,500}playerAttack\.finalDamage\s*>\s*0[\s\S]{0,500}canNpcRetaliate\(target\)[\s\S]{0,500}counterCooldownReady[\s\S]{0,300}retaliationReachOk/.test(combat), 'counterattack gate checks damage, retaliation eligibility, cooldown, and contact/range');
ok(!/canCounterattack\s*=[\s\S]{0,600}\["guard",\s*"hostile",\s*"defensive",\s*"merchant"\]\.includes\(target\.behavior\)/.test(combat), 'counterattack is no longer blocked by the old narrow behavior whitelist');
ok(/function\s+canNpcRetaliate[\s\S]{0,300}!\["training_dummy",\s*"quest_anchor",\s*"passive"\]\.includes\(npc\.behavior\)/.test(combat), 'all real attackable NPCs can retaliate except passive/anchor/training roles');
ok(/function\s+canNpcRunRealtimeCombat[\s\S]{0,100}return\s+canNpcRetaliate\(npc\)/.test(combat), 'realtime AI uses same retaliation eligibility');

ok(/runtimeActorCombatBehavior[\s\S]{0,900}muck\|muckling\|hex\|hexer/.test(combat), 'runtime actor classifier treats Mucklings and Hexers as hostile');
ok(/runtimeActorSpecies[\s\S]{0,700}muck\|muckling\|monster\|creature\|wyrm/.test(combat), 'runtime actor species classifier recognizes monster creatures');
ok(/runtimeActorSocialRole[\s\S]{0,900}muck\|muckling\|hex\|hexer/.test(combat), 'runtime actor social role marks Mucklings and Hexers hostile');
ok(/greater\\s\+hexer[\s\S]{0,220}attackPoints\s*=\s*76/.test(combat), 'Greater Hexer gets meaningful combat stats');
ok(/lesser\\s\+hexer\|hex\|hexer[\s\S]{0,220}attackPoints\s*=\s*54/.test(combat), 'Lesser/normal Hexer gets meaningful combat stats');
ok(/mossy\\s\+muckling\|muckling\|muck[\s\S]{0,220}attackPoints\s*=\s*42/.test(combat), 'Mucklings get meaningful combat stats');
ok(/Hex Swipe/.test(combat) && /Muck Slam/.test(combat), 'NPC retaliation abilities include Hex Swipe and Muck Slam');

ok(/debugHarthmereCombat\("combat\.countercheck"[\s\S]{0,420}contactProven[\s\S]{0,420}retaliationReachOk[\s\S]{0,420}effectiveRetaliationOptions/.test(combat), 'countercheck debug reports contact and decision state');
ok(/function\s+inspectHarthmereRetaliation[\s\S]{0,900}blockers/.test(combat), 'console probe explains blockers');
ok(/function\s+nearestHarthmereCombatTargets/.test(combat), 'console nearest helper exists');
ok(/function\s+forceHarthmereNpcRetaliation/.test(combat), 'console forceRetaliate helper exists');
ok(/installHarthmereCombatDebugListeners[\s\S]{0,700}HARTHMERE_COMBAT_EFFECT_EVENT/.test(combat), 'console listener helper watches combat effect events');
ok(['probe:', 'why:', 'forceRetaliate:', 'attackAndProbe:', 'nearest:', 'actors:', 'runtime:', 'listen:'].every((needle) => combat.includes(needle)), 'debug bridge exposes probe/why/forceRetaliate/attackAndProbe/nearest/actors/runtime/listen');
ok(/attackAndProbe[\s\S]{0,260}contactProven:\s*ability\s*!==\s*"spark"/.test(combat), 'debug attackAndProbe forces melee contact so retaliation can be verified in console');

ok(/function\s+appendCombatLog[\s\S]{0,600}emitHarthmereCombatEffect\(loggedEntry\)/.test(combat), 'every attack log emits a renderer combat effect');
ok(combat.includes('state: targetIsPlayer ? { ...nextState, player: updatedTarget } : nextState'), 'NPC counterattacks write player HP back into state');
ok(/attackerOffset:\s*targetOffset/.test(combat), 'NPC counterattack combat log includes attackerOffset for renderer routing');
if (renderer) {
  ok(/HARTHMERE_COMBAT_EFFECT_EVENT|biomes:harthmere-combat-effect/.test(renderer), 'renderer listens for Harthmere combat effect events');
  ok(/renderer\.combat_event\.attacker_match/.test(renderer), 'renderer logs attacker match diagnostics');
  ok(/renderer\.combat_event\.target_match/.test(renderer), 'renderer logs target match diagnostics');
} else {
  console.warn('WARN renderer file not found; skipped renderer checks');
}

if (failures > 0) {
  console.error(`\nRESULT: FAIL (${failures} failed)`);
  process.exit(1);
}
console.log('\nRESULT: PASS');
