#!/usr/bin/env node
const fs = require('fs');
const path = require('path');

const root = process.argv[2] ? path.resolve(process.argv[2]) : process.cwd();
const combatPath = path.join(root, 'src/client/components/challenges/LocalDevHarthmereCombat.tsx');
const overlaysPath = path.join(root, 'src/client/game/scripts/overlays.ts');
const combat = fs.readFileSync(combatPath, 'utf8');
const overlays = fs.readFileSync(overlaysPath, 'utf8');
const failures = [];
function check(condition, message) {
  if (!condition) failures.push(message);
  else console.log(`PASS ${message}`);
}

check(combat.includes('HARTHMERE_ECS_NPC_RETALIATION_BRIDGE_V187'), 'combat bridge version constant exists');
check(combat.includes('__harthmereEcsNpcCombatActorPositions'), 'combat reads ECS NPC bridge window registry');
check(combat.includes('source: "ecs_npc_overlay_bridge_v187"') || overlays.includes('source: "ecs_npc_overlay_bridge_v187"'), 'ECS NPC bridge source marker exists');
check(combat.includes('Date.now() - at > 3_500') || combat.includes('Date.now() - at > 3500'), 'combat skips stale actor snapshots');

const statsStart = combat.indexOf('function statsForOffset(offset: number): HarthmereCombatStats {');
const training = combat.indexOf('if (offset === HARTHMERE_TRAINING_DUMMY_OFFSET)', statsStart);
const runtimeFirst = combat.indexOf('const runtimeActorStats = statsForRuntimeCombatActor(offset);', statsStart);
check(statsStart >= 0 && runtimeFirst > statsStart && runtimeFirst < training, 'runtime actor stats are preferred before static fallback stats');
const runtimeActorStart = combat.indexOf('function statsForRuntimeCombatActor(');
const actorRead = combat.indexOf('const actor = readHarthmereRuntimeCombatActors()[offset];', runtimeActorStart);
check(runtimeActorStart >= 0 && actorRead > runtimeActorStart && !combat.slice(runtimeActorStart, actorRead).includes('offset < 10_000'), 'runtime actor stats support ECS and reused 900x offsets');
check(combat.includes('function normalizeNpcStatsForOffset'), 'stale visual/combat identity normalization helper exists');
check(/muck\|muckling\|hex\|hexer/.test(combat), 'muckers and hexers are classified as hostile combat actors');

check(overlays.includes('HARTHMERE_ECS_NPC_RETALIATION_BRIDGE_V187'), 'overlay bridge version constant exists');
check(overlays.includes('publishHarthmereEcsNpcCombatActorSnapshotV187'), 'overlay publishes ECS NPC combat snapshots');
check(overlays.includes('__harthmereEcsNpcCombatActorPositions'), 'overlay writes ECS NPC bridge window registry');
check(overlays.includes('Seedy') || /muck\|muckling\|hex\|hexer/.test(overlays), 'overlay bridge classifies muckers/hexers as hostile');
check(overlays.includes('publishHarthmereEcsNpcCombatActorSnapshotV187({});'), 'overlay clears stale ECS bridge when NPC overlays are disabled');

if (failures.length) {
  console.error('\nFAILURES');
  for (const failure of failures) console.error(` - ${failure}`);
  process.exit(1);
}
console.log('\nAll v187 ECS NPC retaliation bridge checks passed.');
