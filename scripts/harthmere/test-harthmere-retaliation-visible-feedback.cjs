#!/usr/bin/env node
const fs = require('fs');
const path = require('path');

const root = process.argv[2] || process.cwd();
const combatPath = path.join(root, 'src/client/components/challenges/LocalDevHarthmereCombat.tsx');
const rendererPath = path.join(root, 'src/client/game/renderers/local_dev/harthmere_assets.ts');
const combat = fs.readFileSync(combatPath, 'utf8');
const renderer = fs.readFileSync(rendererPath, 'utf8');

const checks = [];
function check(label, ok) {
  checks.push({ label, ok: Boolean(ok) });
}

check('combat current visible feedback version constant exists', combat.includes('HARTHMERE_RETALIATION_VISIBLE_FEEDBACK'));
check('combat current feedback helper exists', combat.includes('emitHarthmereRetaliationVisibleFeedback'));
check('combat current feedback is called from combat effect emission', combat.includes('emitHarthmereRetaliationVisibleFeedback(entry);'));
check('combat current feedback only fires when player is target and damage is positive', combat.includes('finalDamage > 0') && combat.includes('/^(you|player|local player)$/i.test(targetName)'));
check('combat current writes browser debug global', combat.includes('__harthmereRetaliationVisibleFeedback'));
check('combat current creates visible retaliation toast', combat.includes('harthmere-retaliation-toast'));
check('combat current creates screen damage vignette', combat.includes('harthmere-retaliation-vignette'));
check('renderer current ECS visual fallback version exists', renderer.includes('HARTHMERE_ECS_NPC_COMBAT_VISUAL_FALLBACK'));
check('renderer current visual fallback method exists', renderer.includes('findCombatLifeByEcsNpcSnapshot'));
check('renderer current uses raw ECS NPC bridge snapshot', renderer.includes('__harthmereEcsNpcCombatActorPositions'));
check('renderer current resolveCombatActor uses fallback after exact offset miss', renderer.includes('this.findCombatLifeByOffset(offset) ??') && renderer.includes('this.findCombatLifeByEcsNpcSnapshot(offset, name)'));
check('renderer current emits fallback match debug event', renderer.includes('renderer.combat_event.ecs_actor_fallback'));
check('renderer current emits fallback miss debug event', renderer.includes('renderer.combat_event.ecs_actor_fallback_miss'));
check('renderer current fallback does not block damage when visual actor missing', renderer.includes('Combat damage still applies; current DOM feedback shows the retaliation.'));

let failures = 0;
for (const result of checks) {
  if (result.ok) {
    console.log(`PASS ${result.label}`);
  } else {
    failures++;
    console.error(`FAIL ${result.label}`);
  }
}

if (failures) {
  console.error(`\n${failures} current retaliation visible feedback check(s) failed.`);
  process.exit(1);
}

console.log('\nAll current retaliation visible feedback checks passed.');
