#!/usr/bin/env node
const fs = require('fs');
const path = require('path');

const root = process.argv[2] ? path.resolve(process.argv[2]) : process.cwd();
const combatPath = path.join(root, 'src/client/components/challenges/LocalDevHarthmereCombat.tsx');
const text = fs.readFileSync(combatPath, 'utf8');
const failures = [];
function check(condition, message) {
  if (!condition) failures.push(message);
  else console.log(`PASS ${message}`);
}

check(text.includes('HARTHMERE_RETALIATION_CURRENT_TRACE_V186'), 'v186 trace version constant exists');
const statsStart = text.indexOf('function statsForOffset(offset: number): HarthmereCombatStats {');
const runtimeFirst = text.indexOf('const runtimeActorStats = statsForRuntimeCombatActor(offset);', statsStart);
const trainingDummy = text.indexOf('if (offset === HARTHMERE_TRAINING_DUMMY_OFFSET)', statsStart);
check(statsStart >= 0 && runtimeFirst > statsStart && runtimeFirst < trainingDummy, 'live runtime actor stats are preferred before static 900x fallback stats');
const runtimeActorStart = text.indexOf('function statsForRuntimeCombatActor(');
const runtimeActorEnd = text.indexOf('const actor = readHarthmereRuntimeCombatActors()[offset];', runtimeActorStart);
check(runtimeActorStart >= 0 && runtimeActorEnd > runtimeActorStart && !text.slice(runtimeActorStart, runtimeActorEnd).includes('offset < 10_000'), 'runtime actor stats are allowed for 900x offsets, not only 10000+ offsets');
check(text.includes('function normalizeNpcStatsForOffset'), 'stale actor identity normalization helper exists');
check(text.includes('rendered actor identity changed for this combat offset'), 'stale visual/combat identity reset is logged');
check(text.includes('function installHarthmereRetaliationTraceBridge'), 'source-level retaliation trace bridge exists');
check(text.includes('__harthmereRetaliationTrace'), 'browser global __harthmereRetaliationTrace is installed by app code');
check(text.includes('visualCombatMismatch'), 'trace reports visual/combat name mismatches');
check(/muck\|muckling\|hex\|hexer/.test(text), 'muckers and hexers are classified as hostile runtime combat actors');
check(text.includes('installHarthmereRetaliationTraceBridge();'), 'trace bridge is installed when combat bridge is installed');

if (failures.length) {
  console.error('\nFAILURES');
  for (const failure of failures) console.error(` - ${failure}`);
  process.exit(1);
}
console.log('\nAll v186 retaliation current-code checks passed.');
