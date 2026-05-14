#!/usr/bin/env node
const fs = require('fs');
const path = require('path');

const root = process.argv[2] || process.cwd();
function read(rel) {
  return fs.readFileSync(path.join(root, rel), 'utf8');
}
function ok(name, cond) {
  if (cond) {
    console.log(`OK ${name}`);
  } else {
    console.log(`FAIL ${name}`);
    failed = true;
  }
}
let failed = false;

const bikkie = read('src/shared/npc/bikkie.ts');
ok('central getNpcBehavior helper', bikkie.includes('export function getNpcBehavior('));
ok('central getNpcBoxSize helper', bikkie.includes('export function getNpcBoxSize('));
ok('central getNpcWalkSpeed helper', bikkie.includes('export function getNpcWalkSpeed('));
ok('central getNpcRunSpeed helper', bikkie.includes('export function getNpcRunSpeed('));
ok('central getNpcRotateSpeed helper', bikkie.includes('export function getNpcRotateSpeed('));

ok('name overlay optional behavior', read('src/client/components/overlays/projected/NameOverlayComponent.tsx').includes('overlay.npcType?.behavior?.questGiver'));
ok('melee filter uses normalized behavior', read('src/client/game/resources/melee_attack_region.ts').includes('getNpcBehavior(idToNpcType(npcTypeId)).damageable?.attackable'));
ok('npc render uses normalized box size', read('src/client/game/resources/npcs.ts').includes('const baseNpcBoxSize = getNpcBoxSize(npcType);'));
ok('npc overlay uses normalized behavior', read('src/client/game/scripts/overlays.ts').includes('getNpcBehavior(npcType).damageable?.attackable'));
ok('spawn uses normalized behavior', read('src/server/spawn/spawn_npc.ts').includes('const behavior = getNpcBehavior(npcType);'));
ok('spawn uses normalized box size', read('src/server/spawn/spawn_npc.ts').includes('let size: Vec3 = getNpcBoxSize(npcType);'));
ok('game observer copies readonly vec', read('src/server/sync/subscription/game_observer.ts').includes('this.scanner.updatePosition([position[0], position[1], position[2]]);'));
ok('chase attack uses normalized run speed', read('src/shared/npc/behavior/chase_attack.ts').includes('getNpcRunSpeed(npc.type) * speedMultiplier'));
ok('logic normalizes behavior once', read('src/shared/npc/logic.ts').includes('const behavior = getNpcBehavior(npc.type);'));
ok('logic uses normalized rotate speed', read('src/shared/npc/logic.ts').includes('rotateTargetTick(npc, getNpcRotateSpeed(npc.type), dtSecs);'));
ok('simulated quest giver uses normalized behavior', read('src/shared/npc/simulated.ts').includes('getNpcBehavior(this.type).questGiver'));

if (failed) {
  console.log('\nRESULT: FAIL');
  process.exit(1);
}
console.log('\nRESULT: PASS');
