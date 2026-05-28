#!/usr/bin/env node
const fs = require('fs');
const path = require('path');

const root = process.argv[2] || process.cwd();
const combatPath = path.join(root, 'src/client/components/challenges/LocalDevHarthmereCombat.tsx');
const npcsPath = path.join(root, 'src/client/game/resources/npcs.ts');
const rendererPath = path.join(root, 'src/client/game/renderers/local_dev/harthmere_assets.ts');
const combat = fs.readFileSync(combatPath, 'utf8');
const npcs = fs.readFileSync(npcsPath, 'utf8');
const renderer = fs.readFileSync(rendererPath, 'utf8');

const checks = [];
function check(label, ok) {
  checks.push({ label, ok: Boolean(ok) });
}

check('combat v191 voxel retaliation animation version constant exists', combat.includes('HARTHMERE_VOXEL_NPC_RETALIATION_ANIMATION_V191'));
check('combat v191 voxel retaliation event name exists', combat.includes('HARTHMERE_VOXEL_NPC_RETALIATION_ANIMATION_EVENT_V191'));
check('combat v191 emitter helper exists', combat.includes('emitHarthmereVoxelNpcRetaliationAnimationV191'));
check('combat v191 emitter is called from combat effect emission', combat.includes('emitHarthmereVoxelNpcRetaliationAnimationV191(entry);'));
check('combat v191 only emits for NPC damage against the player', combat.includes('finalDamage > 0') && combat.includes('/^(you|player|local player)$/i.test(targetName)') && combat.includes('attackerOffset'));
check('combat v191 writes voxel animation global', combat.includes('__harthmereVoxelNpcRetaliationAnimationV191'));
check('combat v191 dispatches browser event for diagnostics', combat.includes('harthmere:voxel-npc-retaliation-animation-v191'));

check('npc resource v191 voxel retaliation version constant exists', npcs.includes('HARTHMERE_VOXEL_NPC_RETALIATION_ANIMATION_V191'));
check('npc resource v191 has native voxel Attack clip', npcs.includes('new THREE.AnimationClip("Attack"'));
check('npc resource v191 Attack clip animates voxel arm/body/head parts', npcs.includes('harthmere-npc-right-arm.rotation[x]') && npcs.includes('harthmere-npc-body.rotation[y]') && npcs.includes('harthmere-npc-head.rotation[x]'));
check('npc resource v191 reads voxel retaliation global', npcs.includes('__harthmereVoxelNpcRetaliationAnimationV191'));
check('npc resource v191 converts browser ms to render secondsSinceEpoch', npcs.includes('secondsSinceEpoch - ageMs / 1000'));
check('npc resource v191 feeds retaliation into native attackTime path', npcs.includes('harthmereVoxelRetaliationAttackTimeV191') && npcs.includes('getAttackAnimationAction'));
check('npc resource v191 records hasAttack in animation load audit', npcs.includes('hasAttack: clipNames.some((name) => /attack/i.test(name))'));

check('renderer v191 does not use v190 Harthmere actor fallback constant', !renderer.includes('HARTHMERE_ECS_NPC_COMBAT_VISUAL_FALLBACK_V190'));
check('renderer v191 does not use v190 ECS snapshot actor fallback method', !renderer.includes('findCombatLifeByEcsNpcSnapshotV190'));
check('renderer v191 does not emit v190 Harthmere fallback match events', !renderer.includes('renderer.combat_event.ecs_actor_fallback_v190'));
check('renderer v191 keeps exact combat offset matching only', renderer.includes('return this.findCombatLifeByOffset(offset);'));

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
  console.error(`\n${failures} v191 voxel NPC retaliation animation check(s) failed.`);
  process.exit(1);
}

console.log('\nAll v191 voxel NPC retaliation animation checks passed.');
