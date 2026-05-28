#!/usr/bin/env node
const fs = require('fs');
const path = require('path');

const root = process.argv[2] || process.cwd();
const combatPath = path.join(root, 'src/client/components/challenges/LocalDevHarthmereCombat.tsx');
const helpersPath = path.join(root, 'src/client/game/interact/helpers.ts');
const combat = fs.readFileSync(combatPath, 'utf8');
const helpers = fs.readFileSync(helpersPath, 'utf8');

const checks = [];
function check(label, ok) {
  checks.push({ label, ok: Boolean(ok) });
}

check('helpers v189 native attack bridge constant exists', helpers.includes('HARTHMERE_NATIVE_NPC_ATTACK_DAMAGE_BRIDGE_V189'));
check('helpers v189 native attack contact event name exists', helpers.includes('biomes:harthmere-native-npc-attack-contact-v189'));
check('helpers emits native NPC attack contact from handleAttackInteraction', helpers.includes('emitHarthmereNativeNpcAttackContactV189({ attackedEntities, tool })'));
check('helpers only bridges entities with npc_metadata', helpers.includes('!record.npc_metadata || !record.position'));
check('helpers dispatches browser CustomEvent for confirmed native NPC hits', helpers.includes('window.dispatchEvent(') && helpers.includes('HARTHMERE_NATIVE_NPC_ATTACK_CONTACT_EVENT_V189'));
check('helpers writes native contact debug global', helpers.includes('__harthmereNativeNpcAttackContactDebugV189'));

check('combat v189 native damage bridge version constant exists', combat.includes('HARTHMERE_NATIVE_NPC_ATTACK_DAMAGE_BRIDGE_V189'));
check('combat v189 native contact event constant exists', combat.includes('HARTHMERE_NATIVE_NPC_ATTACK_CONTACT_EVENT_V189'));
check('combat installs native NPC attack damage bridge at module load', combat.includes('installHarthmereNativeNpcAttackDamageBridgeV189();'));
check('combat listens for native NPC attack contact event', combat.includes('window.addEventListener(HARTHMERE_NATIVE_NPC_ATTACK_CONTACT_EVENT_V189, handler)'));
check('combat removes native NPC attack bridge listener on cleanup', combat.includes('window.removeEventListener(HARTHMERE_NATIVE_NPC_ATTACK_CONTACT_EVENT_V189, handler)'));
check('combat resolves raw ECS NPC id from native hit detail', combat.includes('Number(hit.id ?? hit.entityId ?? hit.offset)'));
check('combat validates target is live and attackable before local damage', combat.includes('!target.attackable || target.hp <= 0 || target.combatState === "dead"'));
check('combat calls performHarthmereCombatAttack from native bridge', combat.includes('performHarthmereCombatAttack(offset, ability, {'));
check('combat marks native contact as proven', combat.includes('contactProven: true'));
check('combat tags native contact source', combat.includes('contactSource: "native_attack_interaction"'));
check('combat explains native hit already confirmed ECS NPC contact', combat.includes('Biomes native handleAttackInteraction already confirmed this ECS NPC was hit.'));
check('combat dedupes repeated native hit events', combat.includes('recentlyResolved') && combat.includes('dedupe_window'));
check('combat writes native bridge debug global', combat.includes('__harthmereNativeNpcAttackDamageBridgeLogV189'));

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
  console.error(`\n${failures} v189 native NPC attack bridge check(s) failed.`);
  process.exit(1);
}

console.log('\nAll v189 native NPC attack damage bridge checks passed.');
