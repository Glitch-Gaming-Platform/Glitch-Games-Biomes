#!/usr/bin/env node
const fs = require('fs');
const path = require('path');

const root = process.argv[2] || process.cwd();
const combatPath = path.join(root, 'src/client/components/challenges/LocalDevHarthmereCombat.tsx');
const npcsPath = path.join(root, 'src/client/game/resources/npcs.ts');
const rendererPath = path.join(root, 'src/client/game/renderers/local_dev/harthmere_assets.ts');

function read(file) {
  if (!fs.existsSync(file)) {
    console.error(`Missing required file: ${file}`);
    process.exit(1);
  }
  return fs.readFileSync(file, 'utf8');
}

const combat = read(combatPath);
const npcs = read(npcsPath);
const renderer = read(rendererPath);

const checks = [];
function check(label, ok) {
  checks.push({ label, ok: Boolean(ok) });
}

check('combat keeps v189 native NPC damage bridge', combat.includes('HARTHMERE_NATIVE_NPC_ATTACK_DAMAGE_BRIDGE_V189') && combat.includes('performHarthmereCombatAttack'));
check('combat keeps v191 voxel retaliation version constant', combat.includes('HARTHMERE_VOXEL_NPC_RETALIATION_ANIMATION_V191'));
check('combat keeps v191 voxel retaliation event name', combat.includes('HARTHMERE_VOXEL_NPC_RETALIATION_ANIMATION_EVENT_V191'));
check('combat emits voxel retaliation event from combat effect emission', combat.includes('emitHarthmereVoxelNpcRetaliationAnimationV191(entry);'));
check('combat emits voxel animation only when NPC damages player', combat.includes('finalDamage > 0') && combat.includes('/^(you|player|local player)$/i.test(targetName)') && combat.includes('attackerOffset'));
check('combat writes v191 voxel animation debug global', combat.includes('__harthmereVoxelNpcRetaliationAnimationV191'));

check('npc resource keeps v191 voxel retaliation version constant', npcs.includes('HARTHMERE_VOXEL_NPC_RETALIATION_ANIMATION_V191'));
check('npc resource has native voxel Attack clip', npcs.includes('new THREE.AnimationClip("Attack"'));
check('npc resource Attack clip animates voxel body parts', npcs.includes('harthmere-npc-right-arm.rotation[x]') && npcs.includes('harthmere-npc-body.rotation[y]') && npcs.includes('harthmere-npc-head.rotation[x]'));
check('npc resource reads voxel retaliation global', npcs.includes('__harthmereVoxelNpcRetaliationAnimationV191'));
check('npc resource feeds retaliation into native attackTime path', npcs.includes('harthmereVoxelRetaliationAttackTimeV191') && npcs.includes('getAttackAnimationAction'));

check('renderer has no v190 Harthmere actor fallback constant', !renderer.includes('HARTHMERE_ECS_NPC_COMBAT_VISUAL_FALLBACK_V190'));
check('renderer has no v190 ECS snapshot actor fallback method reference', !renderer.includes('findCombatLifeByEcsNpcSnapshotV190'));
check('renderer has no v190 fallback debug events', !renderer.includes('renderer.combat_event.ecs_actor_fallback_v190'));
check('renderer does not read ECS combat actor registry for visual retaliation fallback', !renderer.includes('__harthmereEcsNpcCombatActorPositions') || !renderer.includes('findCombatLifeByEcsNpcSnapshot'));
check('renderer combat offset matching is exact after training dummy exception', renderer.includes('return this.findCombatLifeByOffset(offset);'));
check('renderer does not map raw ECS NPC ids to Harthmere GLTF actors for retaliation', !/findCombatLifeByOffset\(offset\)\s*\?\?/.test(renderer));

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
  console.error(`\n${failures} v192 voxel NPC retaliation cleanup check(s) failed.`);
  process.exit(1);
}

console.log('\nAll v192 voxel NPC retaliation cleanup checks passed.');
