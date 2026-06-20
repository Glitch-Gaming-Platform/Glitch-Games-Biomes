#!/usr/bin/env node
/* Static checks for the browser-side Harthmere retaliation trace. */
const fs = require('fs');
const path = require('path');

const root = process.argv[2] ? path.resolve(process.argv[2]) : process.cwd();
const combatPath = path.join(root, 'src/client/components/challenges/LocalDevHarthmereCombat.tsx');
const rendererPath = path.join(root, 'src/client/game/renderers/local_dev/harthmere_assets.ts');
const tracePath = path.join(root, 'scripts/harthmere/harthmere-retaliation-trace.js');

function mustRead(file) {
  if (!fs.existsSync(file)) {
    throw new Error(`Missing expected file: ${path.relative(root, file)}`);
  }
  return fs.readFileSync(file, 'utf8');
}

function assertContains(text, needle, label) {
  if (!text.includes(needle)) {
    throw new Error(`Missing ${label}: ${needle}`);
  }
}

const combat = mustRead(combatPath);
const renderer = mustRead(rendererPath);
const trace = mustRead(tracePath);

assertContains(combat, 'biomes.localDev.harthmere.combatState', 'combat state localStorage key');
assertContains(combat, '__harthmereCombatDebug', 'combat debug bridge');
assertContains(combat, 'biomes:harthmere-combat-debug', 'combat debug event');
assertContains(combat, 'forward_arc.hit', 'forward-arc hit debug stage');
assertContains(combat, 'combat.counter_skip', 'counter skip debug stage');
assertContains(combat, 'fight.ai.retaliate', 'AI retaliation debug stage');
assertContains(combat, 'npcBrains', 'NPC brain memory state');
assertContains(renderer, '__harthmereCombatActorPositions', 'renderer-published actor coordinates');
assertContains(renderer, 'label: actor.label', 'renderer actor visual label');
assertContains(renderer, 'pos: [actor.object.position.x, actor.object.position.z]', 'renderer actor x/z position');
assertContains(trace, '__harthmereRetaliationTrace', 'browser trace global');
assertContains(trace, 'nameMismatch', 'visual/combat name mismatch detection');
assertContains(trace, 'forward_arc.hit', 'forward-arc correctness comparison');
assertContains(trace, 'HP loss detected', 'HP loss detector');

console.log('PASS harthmere-retaliation-trace static checks');
console.log(`Root: ${root}`);
console.log('Browser usage:');
console.log('  pbcopy < scripts/harthmere/harthmere-retaliation-trace.js');
console.log('  Paste into DevTools Console on the /play page');
console.log('  __harthmereRetaliationTrace.start();');
console.log('  Attack the NPC normally');
console.log('  __harthmereRetaliationTrace.download();');
