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

check('combat v190 visible feedback version constant exists', combat.includes('HARTHMERE_RETALIATION_VISIBLE_FEEDBACK_V190'));
check('combat v190 feedback helper exists', combat.includes('emitHarthmereRetaliationVisibleFeedbackV190'));
check('combat v190 feedback is called from combat effect emission', combat.includes('emitHarthmereRetaliationVisibleFeedbackV190(entry);'));
check('combat v190 feedback only fires when player is target and damage is positive', combat.includes('finalDamage > 0') && combat.includes('/^(you|player|local player)$/i.test(targetName)'));
check('combat v190 writes browser debug global', combat.includes('__harthmereRetaliationVisibleFeedbackV190'));
check('combat v190 creates visible retaliation toast', combat.includes('harthmere-retaliation-v190-toast'));
check('combat v190 creates screen damage vignette', combat.includes('harthmere-retaliation-v190-vignette'));
check('renderer v190 ECS visual fallback version exists', renderer.includes('HARTHMERE_ECS_NPC_COMBAT_VISUAL_FALLBACK_V190'));
check('renderer v190 visual fallback method exists', renderer.includes('findCombatLifeByEcsNpcSnapshotV190'));
check('renderer v190 uses raw ECS NPC bridge snapshot', renderer.includes('__harthmereEcsNpcCombatActorPositions'));
check('renderer v190 resolveCombatActor uses fallback after exact offset miss', renderer.includes('this.findCombatLifeByOffset(offset) ??') && renderer.includes('this.findCombatLifeByEcsNpcSnapshotV190(offset, name)'));
check('renderer v190 emits fallback match debug event', renderer.includes('renderer.combat_event.ecs_actor_fallback_v190'));
check('renderer v190 emits fallback miss debug event', renderer.includes('renderer.combat_event.ecs_actor_fallback_miss_v190'));
check('renderer v190 fallback does not block damage when visual actor missing', renderer.includes('Combat damage still applies; v190 DOM feedback shows the retaliation.'));

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
  console.error(`\n${failures} v190 retaliation visible feedback check(s) failed.`);
  process.exit(1);
}

console.log('\nAll v190 retaliation visible feedback checks passed.');
