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

check('helpers current native attack bridge constant exists', helpers.includes('HARTHMERE_NATIVE_NPC_ATTACK_DAMAGE_BRIDGE'));
check('helpers current native attack contact event name exists', helpers.includes('biomes:harthmere-native-npc-attack-contact'));
check('helpers emits native NPC attack contact from handleAttackInteraction', helpers.includes('emitHarthmereNativeNpcAttackContact({ attackedEntities, tool })'));
check('helpers bridges NPC metadata and health-backed live creature entities', helpers.includes('hasNpcMetadata') && helpers.includes('isAttackableLiveEntity') && helpers.includes('Boolean(record.health)'));
check('helpers dispatches browser CustomEvent for confirmed native NPC hits', helpers.includes('window.dispatchEvent(') && helpers.includes('HARTHMERE_NATIVE_NPC_ATTACK_CONTACT_EVENT'));
check('helpers writes native contact debug global', helpers.includes('__harthmereNativeNpcAttackContactDebug'));
check('helpers records latest native contact timestamp for mouse fallback dedupe', helpers.includes('__harthmereNativeNpcAttackContactLastAt'));

check('combat current native damage bridge version constant exists', combat.includes('HARTHMERE_NATIVE_NPC_ATTACK_DAMAGE_BRIDGE'));
check('combat current native contact event constant exists', combat.includes('HARTHMERE_NATIVE_NPC_ATTACK_CONTACT_EVENT'));
check('combat installs native NPC attack damage bridge at module load', combat.includes('installHarthmereNativeNpcAttackDamageBridge();'));
check('combat listens for native NPC attack contact event', /window\.addEventListener\(\s*HARTHMERE_NATIVE_NPC_ATTACK_CONTACT_EVENT,\s*handler\s*\)/.test(combat));
check('combat removes native NPC attack bridge listener on cleanup', /window\.removeEventListener\(\s*HARTHMERE_NATIVE_NPC_ATTACK_CONTACT_EVENT,\s*handler\s*\)/.test(combat));
check('combat resolves raw ECS NPC id from native hit detail', combat.includes('Number(hit.id ?? hit.entityId ?? hit.offset)'));
check('combat validates target is live and attackable before local damage', /!target\.attackable\s*\|\|\s*target\.hp <= 0\s*\|\|\s*target\.combatState === "dead"/.test(combat));
check('combat calls performHarthmereCombatAttack from native bridge', combat.includes('performHarthmereCombatAttack(offset, ability, {'));
check('combat marks native contact as proven', combat.includes('contactProven: true'));
check('combat tags native contact source', combat.includes('contactSource: "native_attack_interaction"'));
check('combat explains native hit already confirmed ECS NPC contact', combat.includes('Biomes native handleAttackInteraction already confirmed this ECS NPC was hit.'));
check('combat dedupes repeated native hit events', combat.includes('recentlyResolved') && combat.includes('dedupe_window'));
check('combat writes native bridge debug global', combat.includes('__harthmereNativeNpcAttackDamageBridgeLog'));

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
  console.error(`\n${failures} current native NPC attack bridge check(s) failed.`);
  process.exit(1);
}

console.log('\nAll current native NPC attack damage bridge checks passed.');
