#!/usr/bin/env node
const fs = require('fs');
const repo = process.argv[2];
if (!repo) {
  console.error('Usage: node check-harthmere-unique-npc-cosmetics-v10b.cjs /path/to/repo');
  process.exit(1);
}
const runtime = fs.readFileSync(`${repo}/src/client/game/renderers/local_dev/harthmere_assets.ts`, 'utf8');
let ok = true;
function expect(condition, message) {
  if (condition) {
    console.log(`OK ${message}`);
  } else {
    console.log(`FAIL ${message}`);
    ok = false;
  }
}
function count(needle) {
  return runtime.split(needle).length - 1;
}
expect(runtime.includes('HARTHMERE_UNIQUE_NPC_COSMETICS_VERSION'), 'unique NPC cosmetics version exists');
expect(runtime.includes('function applyUniqueNpcVisualDecorations('), 'unique NPC cosmetic decorator exists');
expect(runtime.includes('applyUniqueNpcVisualDecorations(placement, clone);'), 'runtime decorates cloned townsperson prototypes');
expect(runtime.includes('applyUniqueNpcVisualDecorations(placement, root);'), 'runtime decorates procedural townspersons');
expect(count('applyUniqueNpcVisualDecorations(placement, clone);') === 1, 'cloned townsperson decorator is not duplicated');
expect(count('applyUniqueNpcVisualDecorations(placement, root);') === 1, 'procedural townsperson decorator is not duplicated');
expect(runtime.indexOf('applyUniqueNpcVisualDecorations(placement, clone);') < runtime.indexOf('this.root.add(clone);'), 'clone cosmetics apply before adding clone to root');
const procStart = runtime.indexOf('function createProceduralTownsperson(');
const procApply = runtime.indexOf('applyUniqueNpcVisualDecorations(placement, root);', procStart);
const procReturn = runtime.indexOf('return root;', procStart);
expect(procStart >= 0 && procApply > procStart && procApply < procReturn, 'procedural cosmetics apply before createProceduralTownsperson returns');
expect(runtime.includes('root.userData.harthmereNpcCosmetics'), 'npc cosmetics metadata is stored');
console.log(`\nRESULT: ${ok ? 'PASS' : 'FAIL'}`);
process.exit(ok ? 0 : 1);
